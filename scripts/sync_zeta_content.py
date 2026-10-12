"""Synchronize the owner's rendered, public zeta pages without account access."""
from __future__ import annotations
import copy
import hashlib
import json
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit
import add_archive_work as importer
import update_zeta_stats as counts
from profile_fields import FIELDS, normalize_profile

ROOT = Path(__file__).resolve().parents[1]
CREATOR = f'https://zeta-ai.io/ja/creators/{importer.CREATOR_ID}/profile'


def normalized(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def name_key(value):
    return re.sub(r'\s|[（(]日常版[）)]', '', value or '')


def protected(record, key):
    return key in record.get('_zetaSync', {}).get('overrides', [])


def bindings(profile, origin):
    result = {}
    for key, value in profile.items():
        pieces = []
        for part in re.split(r'\n\s*\n', value or ''):
            part = normalized(part)
            if part and origin.count(part) == 1:
                start = origin.index(part)
                pieces.append([start, start+len(part)])
        if pieces:
            result[key] = pieces
    return result


def changed_fragments(old, new, spans):
    if old == new:
        return None
    opcodes = SequenceMatcher(None, old, new, autojunk=False).get_opcodes()
    def position(pos, ending):
        for kind, i, j, a, b in opcodes:
            if i <= pos <= j and kind != 'insert':
                if kind == 'equal':
                    return a+pos-i
                if pos == i:
                    return a
                if pos == j:
                    return b
                return None
        return len(new) if pos == len(old) else None
    parts = []
    changed = False
    for start, end in spans:
        a,b = position(start,False),position(end,True)
        if a is None or b is None or a>b:
            return None
        value = new[a:b].strip()
        changed |= value != old[start:end].strip()
        if value:
            parts.append(value)
    return '\n\n'.join(parts) if changed else None


def explicit_profile(raw, url):
    person = importer.character_record(raw, 'source', 1, url)
    if not person:
        raise ValueError('人物の公開プロフィールを確認できませんでした。')
    text = importer.clean(raw['text'])
    facts = person['facts']
    # Printed profile lines such as 35歳｜188cm｜玄城会 若頭.
    for line in text.splitlines()[1:]:
        if re.search(r'\d+歳',line) and re.search(r'\d+(?:\.\d+)?\s*cm',line):
            age = re.search(r'\d+歳(?:前後|ほど|程度)?',line)
            height = re.search(r'\d+(?:\.\d+)?\s*cm',line)
            facts.setdefault('年齢', age[0])
            facts.setdefault('身長', height[0].replace(' ',''))
            parts = re.split(r'[｜|/]',line)
            if len(parts)>=3 and not re.search(r'歳|cm',parts[-1]):
                facts.setdefault('職業',parts[-1].strip())
            break
    person.pop('profile',None)
    profile = normalize_profile(person)
    headings = {'外見':'appearance','容姿':'appearance','性格':'personality','あなたとの関係':'relationship','ユーザーとの関係':'relationship','口調':'speech','話し方':'speech'}
    for label, field in headings.items():
        inline = re.search(r'^'+label+r'\s*[：:]\s*(.+)$',text,re.M)
        if inline:
            profile[field] = inline[1].strip()
    return person, {key:value for key,value in profile.items() if value}


def page_source(source):
    if f'/creators/{importer.CREATOR_ID}/profile' not in source.get('creator',''):
        raise ValueError('対象の作者の公開作品ではありません。')
    public = importer.public_sections(source['text'],source.get('title'))
    public.pop('count',None)
    public['title'] = public['title'].replace('貴方だけの神様。','貴女だけの神様。')
    return {'public':public,'cover':importer.approved_image(source['cover'])}


def store_image(record, field, url, assets, fetch_image):
    if not url or protected(record,field):
        return
    blob,extension = fetch_image(importer.approved_image(url))
    current = ROOT / record.get(field,'')
    if current.is_file() and current.read_bytes()==blob:
        return
    digest = hashlib.sha256(blob).hexdigest()[:16]
    path = f"images/{record['id']}-zeta-{digest}.{extension}"
    assets[path] = blob
    record[field] = path


def sync_page(archive, old, url, source, fetch_image):
    platform,normalized_url,_ = importer.source_url(url)
    if platform!='zeta' or normalized_url!=url:
        raise ValueError('zetaの公開作品URLを確認してください。')
    new = page_source(source)
    public = new['public']
    assets = {}
    work = next((w for w in archive['works'] if any(d.get('url')==url for d in w['destinations'])),None)
    if not work:
        if not source.get('characters'):
            raise ValueError('新しい作品の人物欄を確認できませんでした。')
        archive,work,requests = importer.merge_work(archive,{'作品のURL':url,'シリーズ':'自動判定'},source)
        work['sections'] = [s for s in work['sections'] if s['title']!='登場人物の公開プロフィール']
        for identifier,image in requests:
            record = work if identifier==work['id'] else next(c for c in archive['characters'] if c['id']==identifier)
            store_image(record,'cover' if record is work else 'image',image,assets,fetch_image)
    force = work.get('_zetaSync',{}).get('refresh',False)
    before = old.get('public',{})
    paragraphs = [p for p in public['intro'].split('\n\n') if p.strip()!=public['title']]
    for key,value,source_key in [('title',public['title'],'title'),('summary',public['summary'],'summary'),('tags',public['tags'],'tags'),('story',paragraphs,'intro'),('description','\n\n'.join(paragraphs)[:240],'intro')]:
        if not protected(work,key) and (force or (source_key in before and public[source_key]!=before[source_key])):
            work[key] = value
    if not protected(work,'publicTexts') and (force or any(public[k]!=before.get(k,public[k]) for k in ['intro','opening'])):
        work['publicTexts'] = [s for s in work.get('publicTexts',[]) if s['title'] not in ['掲載時の紹介文','物語が始まる場面']]
        if public['opening']:
            work['publicTexts'].append({'title':'物語が始まる場面','text':public['opening'],'collapsible':True})
    if force or ('tags' in before and public['tags']!=before['tags']):
        if not protected(work,'series'):
            work['series'] = [s['id'] for s in archive['series'] if s['name'] in public['tags']]
        if not protected(work,'genre'):
            genre = next((w['genre'] for w in archive['works'] if w['genre'] in public['tags']),None)
            if genre:
                work['genre'] = genre
    if force or new['cover']!=old.get('cover'):
        store_image(work,'cover',new['cover'],assets,fetch_image)
    prior_people = old.get('characters',{})
    new['characters'] = {}
    cast = []
    raw_people = source.get('characters',[])
    if not raw_people:
        raise ValueError('人物の公開欄が読み込めていないため、この作品は更新しません。')
    for index,raw in enumerate(raw_people,1):
        parsed,explicit = explicit_profile(raw,url)
        match = next(((cid,saved) for cid,saved in prior_people.items() if name_key(saved['name'])==name_key(raw['name'])),None)
        if not match and raw.get('image'):
            identity = urlsplit(importer.approved_image(raw['image'])).path.split('/')[:3]
            match = next(((cid,saved) for cid,saved in prior_people.items() if saved.get('image') and urlsplit(saved['image']).path.split('/')[:3]==identity),None)
        if not match and len(prior_people)==1 and len(raw_people)==1:
            match = next(iter(prior_people.items()))
        person = next((c for c in archive['characters'] if match and c['id']==match[0]),None)
        if not person:
            assigned = [c for c in archive['characters'] if c['id'] in work['characters'] and name_key(c['name'])==name_key(raw['name'])]
            person = assigned[0] if len(assigned)==1 else None
        if not person:
            candidates = [c for c in archive['characters'] if name_key(c['name'])==name_key(raw['name'])]
            person = candidates[0] if len(candidates)==1 else None
        if not person:
            person = parsed
            person['id'] = work['id']+'-person-'+str(index)
            while any(c['id']==person['id'] for c in archive['characters']):
                person['id'] += '-new'
            archive['characters'].append(person)
        saved = match[1] if match else {}
        cast.append(person['id'])
        origin = normalized(public['intro']+'\n'+raw['text'])
        owns = person.get('sourceUrl')==url
        reset = person.get('_zetaSync',{}).get('refresh',False)
        values = dict(explicit)
        if reset:
            values = {**{key:value for key,value in saved.get('profile',{}).items() if key in saved.get('bindings',{})},**values}
        for key,spans in saved.get('bindings',{}).items():
            revised = changed_fragments(saved.get('origin',''),origin,spans)
            if revised is not None:
                values[key] = revised
        if owns:
            profile = normalize_profile(person)
            old_personality = profile['personality']
            if values.get('age') and '見た目' in profile.get('age','') and '見た目' not in values['age']:
                values['age'] += '（見た目）'
            for key,value in values.items():
                previous = saved.get('profile',{}).get(key)
                if not protected(person,'profile.'+key) and (reset or previous is None or (origin!=saved.get('origin') and value!=previous)):
                    profile[key] = value
            person['profile'] = profile
            for key in ['name','reading']:
                value = parsed.get(key,'')
                if key=='name' and '日常版' in person['name']:
                    value += '（日常版）'
                if not protected(person,key) and value and (reset or key in saved and value!=saved[key]):
                    person[key] = value
            if not protected(person,'description') and profile['personality']!=old_personality:
                person['description'] = profile['personality'].split('\n')[0][:160] or person['description']
            image = importer.approved_image(raw['image']) if raw.get('image') else ''
            if image and (reset or image!=saved.get('image')):
                store_image(person,'image',image,assets,fetch_image)
            person.get('_zetaSync',{}).pop('refresh',None)
        profile = {**saved.get('profile',{}),**values}
        new['characters'][person['id']] = {'name':raw['name'],'reading':parsed.get('reading',''),'text':raw['text'],'image':importer.approved_image(raw['image']) if raw.get('image') else '', 'origin':origin,'profile':profile,'bindings':bindings(profile,origin)}
    if not protected(work,'characters'):
        extras = [cid for cid in work['characters'] if cid not in prior_people and cid not in cast]
        work['characters'] = list(dict.fromkeys(cast+extras))
    work.get('_zetaSync',{}).pop('refresh',None)
    return archive,new,assets


def collect_pages(known_urls):
    from playwright.sync_api import sync_playwright
    discovered = set(known_urls)
    observations = {}
    errors = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(locale='ja-JP')
        page = context.new_page()
        response = page.goto(CREATOR,wait_until='domcontentloaded',timeout=60000)
        if response and response.status>=400:
            raise ValueError('作者の公開ページを取得できませんでした。')
        page.locator('main a[href*="/plots/"] img').first.wait_for(timeout=45000)
        unchanged = 0
        for _ in range(50):
            links = page.locator('main a[href*="/plots/"]').evaluate_all("links=>links.filter(a=>a.querySelector('img')).map(a=>a.href)")
            size = len(discovered)
            for link in links:
                try:
                    platform,url,_ = importer.source_url(link)
                    if platform=='zeta':
                        discovered.add(url)
                except ValueError:
                    continue
            unchanged = unchanged+1 if len(discovered)==size else 0
            if unchanged>=5:
                break
            page.mouse.move(680,650)
            page.mouse.wheel(0,650)
            page.wait_for_timeout(1200)
        for url in sorted(discovered):
            try:
                observations[url] = importer.collect_zeta_page(page,url)
            except Exception as error:
                if url in known_urls:
                    errors[url] = str(error)
        browser.close()
    return observations,errors


def synchronize(archive,state,observations,fetch_image):
    updated = copy.deepcopy(archive)
    next_state = copy.deepcopy(state)
    next_state.setdefault('pages',{})
    assets = {}
    errors = {}
    accepted = 0
    downloaded = {}
    def cached_image(url):
        if url not in downloaded:
            downloaded[url] = fetch_image(url)
        return downloaded[url]
    for url,source in observations.items():
        try:
            candidate,snapshot,images = sync_page(copy.deepcopy(updated),next_state['pages'].get(url,{}),url,source,cached_image)
            updated = candidate
            next_state['pages'][url] = snapshot
            assets.update(images)
            accepted += 1
        except Exception as error:
            errors[url] = str(error)
    if not accepted:
        raise ValueError('公開内容を確認できた作品がありません。既存データは更新しません。')
    return updated,next_state,assets,errors


def main():
    archive = json.loads((ROOT/'assets/content.js').read_text().removeprefix('window.ARCHIVE = ').strip().rstrip(';'))
    state_path = ROOT/'assets/zeta-sync.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {'version':1,'pages':{}}
    known = [d['url'] for w in archive['works'] for d in w['destinations'] if d['name']=='zeta' and d['status']=='published']
    observations,errors = collect_pages(known)
    updated,next_state,assets,failed = synchronize(archive,state,observations,importer.image_bytes)
    errors.update(failed)
    next_state['errors'] = errors
    # All image downloads and validations finish before any file is written.
    for path,blob in assets.items():
        (ROOT/path).write_bytes(blob)
    (ROOT/'assets/content.js').write_text('window.ARCHIVE = '+json.dumps(updated,ensure_ascii=False,indent=2)+';\n')
    state_path.write_text(json.dumps(next_state,ensure_ascii=False,indent=2)+'\n')
    urls = {w['id']:d['url'] for w in updated['works'] for d in w['destinations'] if d['name']=='zeta' and d['status']=='published'}
    try:
        rows = [{'url':url,'label':importer.public_sections(observations[url]['text'],observations[url]['title'])['count']} for url in urls.values()]
        snapshot = counts.build_snapshot(rows,urls,datetime.now(timezone.utc).isoformat())
        previous = counts.ROOT
        try:
            counts.ROOT=ROOT
            counts.write_snapshot(snapshot)
        finally:
            counts.ROOT=previous
    except (ValueError,KeyError,TypeError,AttributeError):
        print('一部トーク数を確認できないため、前回の集計を維持しました。')
    print(f'zeta公開内容の同期が完了しました。{len(observations)-len(failed)}件確認／{len(errors)}件保留。')
    for url,error in errors.items():
        print(url+': '+error)


if __name__=='__main__':
    main()
