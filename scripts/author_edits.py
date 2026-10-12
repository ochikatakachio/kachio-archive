"""Validate owner-only patches for existing works and character profiles."""
import copy
import hashlib
import json
import re
import uuid
from profile_fields import normalize_profile, FIELDS

PREFIXES = ('[作品編集]', '[人物編集]', '[人物追加]')


def protect_zeta_fields(record, previous, keys, reset=False):
    if not isinstance(reset, bool):
        raise ValueError('zeta同期の指定を確認してください。')
    def value(item, path):
        for part in path.split('.'):
            item = item.get(part) if isinstance(item, dict) else None
        return item
    sync = record.setdefault('_zetaSync', {})
    if reset:
        sync['overrides'] = []
        sync['refresh'] = True
    else:
        changed = [key for key in keys if value(record,key) != value(previous,key)]
        sync['overrides'] = sorted(set(sync.get('overrides', [])) | set(changed))
    if not sync.get('overrides') and not sync.get('refresh'):
        record.pop('_zetaSync', None)


def fingerprint(record):
    raw = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def parse_edit(issue, owner):
    if issue.get('user', {}).get('login', '').casefold() != owner.casefold() or issue.get('pull_request'):
        raise ValueError('作者が送信した編集だけ受け付けます。')
    kind = next((prefix for prefix in PREFIXES if issue.get('title', '').startswith(prefix)), None)
    if not kind:
        raise ValueError('作者用画面から編集内容を送信してください。')
    body = issue.get('body') or ''
    if len(body) > 65000:
        raise ValueError('編集内容が長すぎます。')
    if not re.search(r'^- \[[xX]\] この内容を公開サイトに反映します\s*$', body, re.M):
        raise ValueError('公開する内容の確認が必要です。')
    match = re.search(r'^### 編集データ\s*\n```json\s*\n(.*?)\n```\s*$', body, re.M | re.S)
    if not match:
        raise ValueError('編集データを確認できませんでした。')
    data = json.loads(match[1])
    if not isinstance(data, dict) or not isinstance(data.get('patch'), dict):
        raise ValueError('編集データの形式が違います。')
    return kind, data


def text(value, limit=8000):
    if not isinstance(value, str) or len(value) > limit or '\x00' in value:
        raise ValueError('入力の長さまたは形式を確認してください。')
    return value.strip()


def sections(value, limit=40):
    if not isinstance(value, list) or len(value) > limit:
        raise ValueError('設定の項目数を確認してください。')
    result = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError('設定の形式を確認してください。')
        title, body = text(item.get('title', ''), 160), text(item.get('text', ''), 16000)
        if not body:
            continue
        result.append({'title': title or '設定', 'text': body, **({'spoiler': True} if item.get('spoiler') is True else {})})
    return result


def ids(value, allowed):
    if not isinstance(value, list) or any(not isinstance(v, str) or v not in allowed for v in value):
        raise ValueError('選択した作品・人物・シリーズを確認してください。')
    return list(dict.fromkeys(value))


def verify_revision(record, expected):
    if fingerprint(record) != expected:
        raise ValueError('別の更新が入っています。作者用画面で最新データを読み込み、編集し直してください。')


def apply_edit(archive, kind, data):
    updated = copy.deepcopy(archive)
    patch = data['patch']
    if kind == '[作品編集]':
        work = next((w for w in updated['works'] if w['id'] == data.get('id')), None)
        if not work:
            raise ValueError('編集する作品が見つかりません。')
        verify_revision(work, data.get('revision'))
        previous = copy.deepcopy(work)
        for key, limit in [('title',160),('summary',300),('description',1000),('genre',80)]:
            if key in patch:
                work[key] = text(patch[key], limit)
        work['title'] = work['title'].replace('貴方だけの神様。','貴女だけの神様。')
        if not work['title'] or not work['genre']:
            raise ValueError('作品名とジャンルを入力してください。')
        if 'story' in patch:
            work['story'] = [p.strip() for p in text(patch['story'], 24000).split('\n\n') if p.strip()]
            if not work['story']:
                raise ValueError('作品紹介を入力してください。')
        if 'tags' in patch:
            if not isinstance(patch['tags'], list) or len(patch['tags']) > 50:
                raise ValueError('タグを確認してください。')
            work['tags'] = list(dict.fromkeys(text(v, 80).lstrip('#') for v in patch['tags'] if v.strip()))
        if 'series' in patch:
            work['series'] = ids(patch['series'], {s['id'] for s in updated['series']})
        if 'characters' in patch:
            work['characters'] = ids(patch['characters'], {c['id'] for c in updated['characters']})
        if 'world' in patch:
            world = text(patch['world'], 160)
            if world and world not in {w['id'] for w in updated['worlds']}:
                raise ValueError('世界観を選び直してください。')
            work['world'] = world
        if 'sections' in patch:
            work['sections'] = sections(patch['sections'])
        if 'opening' in patch or 'publishedIntroduction' in patch:
            public = [s for s in work.get('publicTexts', []) if s['title'] not in ['物語が始まる場面','掲載時の紹介文']]
            for key, title in [('publishedIntroduction','掲載時の紹介文'),('opening','物語が始まる場面')]:
                old = next((s['text'] for s in work.get('publicTexts', []) if s['title']==title), '')
                value = text(patch[key], 24000) if key in patch else old
                if value:
                    public.append({'title':title,'text':value,'collapsible':True})
            work['publicTexts'] = public
        if 'destinations' in patch:
            from add_archive_work import source_url
            destinations = []
            for value in patch['destinations']:
                if not value.strip():
                    continue
                name, url, _ = source_url(text(value, 2048))
                if any(d['name']==name for d in destinations):
                    raise ValueError('一つの投稿先につき、一つのURLを入れてください。')
                original = next((d for d in work['destinations'] if d['url']==url), {})
                destinations.append({**original, 'name':name,'url':url,'status':'published'})
            if not destinations:
                raise ValueError('投稿先URLを一つ以上入れてください。')
            work['destinations'] = destinations
        protect_zeta_fields(work, previous, ['title','summary','description','story','tags','genre','series','publicTexts'], patch.get('resetZetaSync',False))
        return updated, work, 'cover'
    if kind == '[人物追加]':
        parent = next((w for w in updated['works'] if w['id']==data.get('workId')), None)
        if not parent:
            raise ValueError('人物が登場する作品を選んでください。')
        verify_revision(parent, data.get('revision'))
        person = {'id':'person-'+str(uuid.uuid4()),'name':'','reading':'','description':'',
                  'facts':{},'sections':[],'image':'','sourceUrl':''}
        parent['characters'].append(person['id'])
        updated['characters'].append(person)
    else:
        person = next((c for c in updated['characters'] if c['id']==data.get('id')), None)
        if not person:
            raise ValueError('人物が見つかりません。')
        verify_revision(person, data.get('revision'))
    previous = copy.deepcopy(person)
    for key in ['name','reading']:
        if key in patch:
            person[key] = text(patch[key],160)
    if not person['name']:
        raise ValueError('人物の名前を入力してください。')
    profile = normalize_profile(person)
    values = patch.get('profile', {})
    if not isinstance(values,dict) or any(key not in FIELDS for key in values):
        raise ValueError('人物紹介の入力項目を確認してください。')
    for key, value in values.items():
        profile[key] = text(value,8000)
    person['profile'] = profile
    if 'facts' in patch:
        if not isinstance(patch['facts'],dict) or len(patch['facts'])>60:
            raise ValueError('補足設定の項目数を確認してください。')
        person['facts'] = {text(key,80):text(value,8000) for key,value in patch['facts'].items() if key.strip()}
    if 'behindSettings' in patch:
        person['behindSettings'] = sections(patch['behindSettings'])
    person['description'] = profile['personality'].split('\n')[0][:160] or person.get('description','')
    for key, label in [('height','身長'),('occupation','職業'),('birthday','誕生日')]:
        if profile[key]:
            person['facts'][label] = profile[key]
        else:
            person['facts'].pop(label,None)
    if 'sections' in patch:
        person['sections'] = sections(patch['sections'])
    protect_zeta_fields(person, previous, ['name','reading']+['profile.'+key for key in FIELDS], patch.get('resetZetaSync',False))
    return updated, person, 'image'
