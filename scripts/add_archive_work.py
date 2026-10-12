"""Import an owner-submitted work from a GitHub issue form.

Only public zeta DOM content and explicitly entered public form content are
used. Assets and data are staged and committed together by the workflow.
"""
from __future__ import annotations

import argparse
import copy
import io
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener

from update_zeta_stats import parse_count
from profile_fields import normalize_profile

ROOT = Path(__file__).resolve().parents[1]
CREATOR_ID = 'bdab83f9-595a-4374-bb7b-497a5a64174d'
UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
LABELS = ['作品のURL', 'シリーズ', '新しいシリーズ名', 'ジャンル', '作品名', '短い紹介',
          '紹介文', '表紙', '人物紹介・世界観', '既存の世界観', 'まとめる作品', 'ほかの投稿先URL', '追加の確認']


def source_url(value: str) -> tuple[str, str, str]:
    p = urlsplit(value.strip())
    if p.scheme != 'https' or p.username or p.password or p.port:
        raise ValueError('作品ページのhttps URLを指定してください。')
    patterns = [('zeta', ['zeta-ai.io'], rf'/(?:ja|en|ko)/plots/({UUID})/profile/?'),
                ('Chacha', ['chacha-ai.io'], rf'/ja/characters/({UUID})/?'),
                ('Plaitoon', ['www.plaitoon.com', 'plaitoon.com'], rf'/(?:ja/)?characters/({UUID})/?')]
    for platform, hosts, pattern in patterns:
        match = re.fullmatch(pattern, p.path, re.I)
        if p.hostname in hosts and match:
            host = 'www.plaitoon.com' if platform == 'Plaitoon' else p.hostname
            path = f'/ja/plots/{match[1].lower()}/profile' if platform == 'zeta' else p.path.rstrip('/')
            return platform, urlunsplit(('https', host, path, '', '')), match[1].lower()
    raise ValueError('zeta・Chacha・Plaitoonの作品ページを指定してください。')


def parse_fields(issue: dict, owner: str) -> dict[str, str]:
    if issue.get('user', {}).get('login', '').casefold() != owner.casefold():
        raise ValueError('リポジトリ所有者が送信した追加依頼だけ受け付けます。')
    if issue.get('pull_request') or not issue.get('title', '').startswith('[作品追加]'):
        raise ValueError('作品追加フォームから送信してください。')
    body = issue.get('body') or ''
    if len(body) > 65000:
        raise ValueError('入力が長すぎます。')
    pattern = r'^### (' + '|'.join(map(re.escape, LABELS)) + r')\s*$'
    markers = list(re.finditer(pattern, body, re.M))
    fields = {}
    for i, match in enumerate(markers):
        key = match[1]
        if key in fields:
            raise ValueError('同じ入力項目が複数あります。フォームを確認してください。')
        value = body[match.end():markers[i + 1].start() if i + 1 < len(markers) else len(body)].strip()
        fields[key] = '' if value == '_No response_' else value
    if not re.search(r'^- \[[xX]\] この作品を公開サイトに追加します\s*$', fields.get('追加の確認', ''), re.M):
        raise ValueError('公開サイトへ追加する確認欄にチェックを入れてください。')
    source_url(fields.get('作品のURL', ''))
    if not fields.get('表紙'):
        attachment = attachment_url(body)
        if attachment:
            fields['表紙'] = attachment
    return fields


def clean(text: str) -> str:
    return re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+', '\n\n', text.replace('\r\n', '\n')).strip()


def attachment_url(body: str) -> str | None:
    # JSON prose may itself mention images; only explicit attachments outside
    # the edit payload can replace the actual cover or character portrait.
    visible = re.sub(r'^```json\s*\n.*?^```\s*$', '', body, flags=re.M | re.S)
    pattern = r'!\[[^\]]*\]\((https://[^\s)]+)\)|<img\b[^>]*\bsrc=[\'\"](https://[^\'\"]+)[\'\"]'
    match = re.search(pattern,visible,re.I)
    return (match[1] or match[2]) if match else None


def public_sections(text: str, known_title: str | None = None) -> dict:
    def heading(name, start=0):
        match = re.search(r'^' + re.escape(name) + r'\s*$', text[start:], re.M)
        if not match:
            raise ValueError(f'公開ページの「{name}」を確認できませんでした。')
        return start + match.start(), start + match.end()
    intro_start, intro_end = heading('紹介')
    profiles_start, profiles_end = heading('プロット', intro_end)
    opening_start, opening_end = heading('イントロ', profiles_end)
    settings = re.search(r'^設定集\s*$', text[profiles_end:opening_start], re.M)
    profile_stop = profiles_end + settings.start() if settings else opening_start
    end_marker = re.search(r'^(?:クリエイターコメント\s*$|リリース日\b|.*が気に入ったなら)', text[opening_end:], re.M)
    opening_stop = opening_end + end_marker.start() if end_marker else len(text)
    header = [line.strip() for line in text[:intro_start].splitlines() if line.strip()]
    if known_title:
        if known_title not in header:
            raise ValueError('画面の作品名と公開紹介を照合できませんでした。')
        header = header[header.index(known_title):]
    tags = [line[1:] for line in header if line.startswith('#')]
    count = None
    last_tag = max((i for i, line in enumerate(header) if line.startswith('#')), default=1)
    for line in header[last_tag + 1:]:
        if re.fullmatch(r'[\d,.]+[万億]?', line):
            count = line
            break
    introduction = clean(text[intro_end:profiles_start])
    if not header or not introduction:
        raise ValueError('作品名または公開紹介を確認できませんでした。')
    return {'title': header[0], 'summary': header[1] if len(header) > 1 and not header[1].startswith('#') else '',
            'tags': tags, 'count': count, 'intro': introduction,
            'profiles': clean(text[profiles_end:profile_stop]), 'opening': clean(text[opening_end:opening_stop])}


def collect_zeta(url: str) -> dict:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(locale='ja-JP')
        result = collect_zeta_page(page, url)
        browser.close()
    return result


def collect_zeta_page(page, url: str) -> dict:
    response = page.goto(url, wait_until='domcontentloaded', timeout=60000)
    if response and response.status >= 400:
        raise ValueError(f'zetaの公開ページを取得できませんでした（HTTP {response.status}）。')
    page.locator('main img[alt="cover image"]').wait_for(timeout=45000)
    page.get_by_role('heading', name='イントロ', exact=True).wait_for(state='attached', timeout=45000)
    result = page.locator('main').evaluate("""main => ({
      text: main.innerText,
      title: document.querySelector('nav h3')?.innerText,
      cover: main.querySelector('img[alt="cover image"]')?.getAttribute('src'),
      creator: main.querySelector('a[href*="/creators/"]')?.href,
      characters: Array.from(main.querySelectorAll('[data-sentry-component="PlotCharacterAbout"]')).map(el => ({
        name: el.querySelector('img[alt^="Profile image of "]')?.alt.replace('Profile image of ', ''),
        text: el.innerText,
        image: el.querySelector('img[alt^="Profile image of "]')?.getAttribute('src')
      }))
    })""")
    if not result.get('creator') or f'/creators/{CREATOR_ID}/profile' not in result['creator']:
        raise ValueError('作者プロフィールに掲載されている、ご自身のzeta作品のURLを使ってください。')
    if not result.get('cover'):
        raise ValueError('掲載表紙を確認できませんでした。')
    if not result.get('title'):
        raise ValueError('画面の作品名を確認できませんでした。')
    return result

def approved_image(url: str) -> str:
    p = urlsplit(url)
    if p.scheme != 'https' or p.username or p.password or p.port:
        raise ValueError('表紙はGitHubに添付した画像か、zetaの掲載画像を指定してください。')
    host = p.hostname or ''
    allowed = (host == 'image.zeta-ai.io' and p.path.startswith(('/plot-cover-image/', '/profile-image/')))
    allowed |= host == 'github.com' and p.path.startswith('/user-attachments/')
    allowed |= host in ['user-images.githubusercontent.com', 'objects.githubusercontent.com']
    allowed |= bool(re.fullmatch(r'github-production-(?:user-asset|repository-file|release-asset)-[a-z0-9]+\.s3\.amazonaws\.com', host))
    if not allowed:
        raise ValueError('画像は、GitHubの「表紙」欄にドラッグして添付してください。')
    # The original image preserves the published image quality.
    return urlunsplit((p.scheme, p.netloc, p.path, '' if host == 'image.zeta-ai.io' else p.query, ''))


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def image_bytes(url: str) -> tuple[bytes, str]:
    from PIL import Image
    url = approved_image(url)
    opener = build_opener(NoRedirect)
    for _ in range(6):
        try:
            with opener.open(Request(url, headers={'User-Agent': 'KachioArchive/1.0'}), timeout=35) as response:
                blob = response.read(16 * 1024 * 1024 + 1)
            break
        except HTTPError as error:
            if error.code not in [301, 302, 303, 307, 308] or not error.headers.get('Location'):
                raise ValueError('画像を取得できませんでした。表紙をGitHubに添付して再実行してください。') from None
            url = approved_image(urljoin(url, error.headers['Location']))
    else:
        raise ValueError('画像の転送先を確認できませんでした。')
    if len(blob) > 16 * 1024 * 1024:
        raise ValueError('画像は16MB以下にしてください。')
    with Image.open(io.BytesIO(blob)) as image:
        extension = {'PNG': 'png', 'JPEG': 'jpg', 'WEBP': 'webp', 'GIF': 'gif'}.get(image.format)
        image.verify()
    if not extension:
        raise ValueError('PNG・JPEG・WebP・GIFの画像を添付してください。')
    return blob, extension


def character_record(raw: dict, work_id: str, index: int, url: str) -> dict | None:
    name, text = (raw.get('name') or '').strip(), clean(raw.get('text') or '')
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not name or not lines or lines[0] != name:
        return None
    reading = lines[1] if len(lines) > 1 and re.fullmatch(r'[ぁ-ゖー・ 　]+', lines[1]) else ''
    facts = {}
    for line in lines[1:]:
        match = re.fullmatch(r'([^：:\n]{1,12})[：:]\s*(.{1,80})', line)
        if match:
            facts.setdefault(match[1], match[2])
    lead = next((line for line in lines[1:] if len(line) >= 8 and line != reading
                 and not re.search(r'[：:]|\d+(?:歳|cm)|^[【📢🔮📺]', line)), '')
    person = {'id': f'{work_id}-person-{index}', 'name': name, 'reading': reading,
            'description': lead[:120], 'facts': facts,
            'sections': [{'title': '公開プロフィール', 'text': clean('\n'.join(text.splitlines()[1:]))}],
            'image': '', 'sourceUrl': url, 'behindSettings': []}
    person['profile'] = normalize_profile(person)
    return person


def merge_work(archive: dict, fields: dict, source: dict | None) -> tuple[dict, dict, list[tuple[str, str]]]:
    archive = copy.deepcopy(archive)
    platform, url, uuid = source_url(fields['作品のURL'])
    urls = [url] + re.findall(r'https://[^\s<>()]+', fields.get('ほかの投稿先URL', ''))
    destinations = []
    for value in urls:
        name, normalized, _ = source_url(value)
        if any(d['name'] == name and d['url'] != normalized for d in destinations):
            raise ValueError('一つの投稿先につき、一つの作品URLを指定してください。')
        if not any(d['url'] == normalized for d in destinations):
            destinations.append({'name': name, 'url': normalized, 'status': 'published'})
    existing = next((w for w in archive['works'] if any(d['url'] == url for d in w['destinations'])), None)
    merge_title = fields.get('まとめる作品')
    if merge_title:
        selected = [w for w in archive['works'] if w['title'] == merge_title]
        if len(selected) != 1 or (existing and existing['id'] != selected[0]['id']):
            raise ValueError('まとめる作品を一つに特定できませんでした。')
        existing = selected[0]
    if existing:
        for destination in destinations:
            if any(d['name'] == destination['name'] and d['url'] != destination['url'] for d in existing['destinations']):
                raise ValueError('その作品には同じ投稿先の別URLが登録済みです。')
            if not any(d['url'] == destination['url'] for d in existing['destinations']):
                listed_title = fields.get('作品名', '').replace('貴方だけの神様。', '貴女だけの神様。')
                if destination['name'] == 'Chacha' and listed_title and listed_title != existing['title']:
                    destination['title'] = listed_title
                existing['destinations'].append(destination)
        return archive, existing, []
    public = public_sections(source['text'], source.get('title')) if source else None
    title = fields.get('作品名') or (public['title'] if public else '')
    if title == '貴方だけの神様。':
        title = '貴女だけの神様。'
    intro = fields.get('紹介文') or (public['intro'] if public else '')
    if not title or not intro or len(title) > 160:
        raise ValueError('作品名と紹介文を入力してください。')
    cover_input = fields.get('表紙', '')
    cover_match = re.search(r'https://[^\s<>()]+', cover_input)
    cover = cover_match[0] if cover_match else (source.get('cover') if source else None)
    if not cover:
        raise ValueError('GitHubの「表紙」欄へ画像をドラッグして添付してください。')
    work_id = platform.lower() + '-' + uuid
    if any(w['id'] == work_id for w in archive['works']):
        raise ValueError('同じ作品IDが登録されています。')
    tags = public['tags'] if public else []
    chosen = fields.get('シリーズ', '自動判定') or '自動判定'
    member = []
    new_series = fields.get('新しいシリーズ名')
    if new_series:
        if len(new_series) > 80:
            raise ValueError('シリーズ名は80文字以内にしてください。')
        same = next((s for s in archive['series'] if s['name'] == new_series), None)
        if not same:
            same = {'id': 'series-' + uuid, 'name': new_series, 'description': new_series + 'の作品をまとめたシリーズ。', 'sections': [], 'color': '#c3a477'}
            archive['series'].append(same)
        member = [same['id']]
    elif chosen == '自動判定':
        member = [s['id'] for s in archive['series'] if s['name'] in tags]
    elif chosen != 'シリーズなし':
        selected = next((s for s in archive['series'] if s['name'] == chosen), None)
        if not selected:
            raise ValueError('選択したシリーズがありません。新しいシリーズ名欄を使ってください。')
        member = [selected['id']]
    genre = fields.get('ジャンル') or next((g for g in dict.fromkeys(w['genre'] for w in archive['works']) if g in tags), 'その他')
    world_name = fields.get('既存の世界観')
    world = next((w for w in archive['worlds'] if w['name'] == world_name), None)
    if world_name and not world:
        raise ValueError('指定した世界観がありません。補足は人物紹介・世界観欄に入れてください。')
    sections = copy.deepcopy(world['sections']) if world else []
    assets = [(work_id, approved_image(cover))]
    people, complete, seen = [], True, set()
    for index, raw in enumerate(source.get('characters', []) if source else [], 1):
        person = character_record(raw, work_id, index, url)
        if not person or not raw.get('image'):
            complete = False
            continue
        if person['name'] in seen:
            continue
        seen.add(person['name'])
        assets.append((person['id'], approved_image(raw['image'])))
        people.append(person)
    if public and public['profiles'] and (not people or not complete):
        sections.append({'title': '登場人物の公開プロフィール', 'text': public['profiles']})
    if fields.get('人物紹介・世界観'):
        sections.append({'title': '人物紹介・世界観', 'text': fields['人物紹介・世界観']})
    archive['characters'].extend(people)
    work = {'id': work_id, 'title': title, 'label': 'STORY FILE',
            'number': str(max(int(w['number']) for w in archive['works']) + 1).zfill(2),
            'genre': genre, 'tags': tags, 'color': '#c3a477', 'cover': '',
            'summary': fields.get('短い紹介') or (public['summary'] if public else '') or intro.split('\n')[0][:120],
            'description': intro.split('\n\n')[0][:240], 'story': clean(intro).split('\n\n'),
            'characters': [person['id'] for person in people], 'world': world['id'] if world else '',
            'sections': sections, 'destinations': destinations, 'gallery': [], 'related': [], 'series': member,
            'publicTexts': [{'title': '物語が始まる場面', 'text': public['opening'], 'collapsible': True}] if public and public['opening'] else []}
    overrides = []
    for label, keys in [('作品名',['title']),('短い紹介',['summary']),('紹介文',['story','description']),('ジャンル',['genre'])]:
        if fields.get(label):
            overrides.extend(keys)
    if cover_match:
        overrides.append('cover')
    if new_series or chosen not in ['自動判定','']:
        overrides.append('series')
    if overrides:
        work['_zetaSync'] = {'overrides':sorted(set(overrides))}
    archive['works'].append(work)
    return archive, work, assets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--event', type=Path, default=Path(os.environ.get('GITHUB_EVENT_PATH', 'event.json')))
    parser.add_argument('--issue-file', type=Path)
    args = parser.parse_args()
    event = json.loads(args.event.read_text())
    issue = json.loads(args.issue_file.read_text()) if args.issue_file else event['issue']
    original = (ROOT / 'assets/content.js').read_text().strip()
    archive = json.loads(original.removeprefix('window.ARCHIVE = ').removesuffix(';'))
    if issue.get('title','').startswith(('[作品編集]','[人物編集]','[人物追加]')):
        from author_edits import parse_edit, apply_edit
        kind, data = parse_edit(issue,event['repository']['owner']['login'])
        updated, record, image_field = apply_edit(archive,kind,data)
        attachment = attachment_url(issue.get('body') or '')
        if attachment:
            blob, extension = image_bytes(attachment)
            path = f"images/{record['id']}-author.{extension}"
            (ROOT / path).write_bytes(blob)
            record[image_field] = path
            record.setdefault('_zetaSync',{}).setdefault('overrides',[]).append(image_field)
        (ROOT / 'assets/content.js').write_text('window.ARCHIVE = '+json.dumps(updated,ensure_ascii=False,indent=2)+';\n')
        print('作者の編集内容を準備しました。')
        return
    fields = parse_fields(issue, event['repository']['owner']['login'])
    platform, url, _ = source_url(fields['作品のURL'])
    known = fields.get('まとめる作品') or any(d['url'] == url for w in archive['works'] for d in w['destinations'])
    manual = all(fields.get(key) for key in ['作品名', '紹介文', '表紙'])
    source = collect_zeta(url) if platform == 'zeta' and not known and not manual else None
    updated, work, assets = merge_work(archive, fields, source)
    pending = []
    for asset_id, remote in assets:
        blob, extension = image_bytes(remote)
        path = f'images/{asset_id}.{extension}'
        pending.append((ROOT / path, blob))
        if asset_id == work['id']:
            work['cover'] = path
        else:
            next(c for c in updated['characters'] if c['id'] == asset_id)['image'] = path
    for path, blob in pending:
        path.write_bytes(blob)
    (ROOT / 'assets/content.js').write_text('window.ARCHIVE = ' + json.dumps(updated, ensure_ascii=False, indent=2) + ';\n')
    if source:
        public = public_sections(source['text'], source.get('title'))
        if public['count']:
            stats = json.loads((ROOT / 'assets/zeta-stats.json').read_text())
            stats['works'][work['id']] = {'count': parse_count(public['count']), 'label': public['count'],
                                        'approximate': bool(re.search('[万億]', public['count'])),
                                        'sourceOrder': max((e['sourceOrder'] for e in stats['works'].values()), default=-1) + 1, 'sourceUrl': url}
            # Existing entries keep their original verification timestamp until
            # the next complete daily refresh; never mark old values as fresh.
            text = json.dumps(stats, ensure_ascii=False, indent=2)
            (ROOT / 'assets/zeta-stats.json').write_text(text + '\n')
            (ROOT / 'assets/zeta-stats.js').write_text('window.ZETA_STATS = ' + text + ';\n')
    print('作品の登録データと画像を準備しました。')


if __name__ == '__main__':
    main()
