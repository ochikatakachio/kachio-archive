"""Public character fields; birthdays are never inferred from ages."""
import re

FIELDS = ('birthday', 'height', 'occupation', 'appearance', 'personality', 'relationship', 'age', 'speech')


def public_age(facts):
    if facts.get('年齢'):
        return facts['年齢']
    if facts.get('見た目の年齢'):
        return facts['見た目の年齢'] + '（見た目）'
    return ''


def public_speech(character):
    facts = character.get('facts', {})
    lines = [facts[key] for key in ['口調', '話し方'] if facts.get(key)]
    for key in ['一人称', '二人称', '呼び方']:
        if facts.get(key):
            lines.append(key + '：' + facts[key])
    for section in character.get('sections', []):
        if section.get('visibility') != 'private' and re.search(r'話し方|口調|呼び方', section.get('title', '')):
            if section.get('text') and section['text'] not in lines:
                lines.append(section['text'])
    return '\n\n'.join(lines)


def normalize_profile(character):
    facts = character.get('facts', {})
    profile = {key: str(character.get('profile', {}).get(key, '')) for key in FIELDS}
    if 'age' not in character.get('profile', {}):
        profile['age'] = public_age(facts)
    if 'speech' not in character.get('profile', {}):
        profile['speech'] = public_speech(character)
    if 'profile' in character:
        return profile
    profile['birthday'] = facts.get('誕生日', '')
    profile['height'] = facts.get('身長', '')
    profile['occupation'] = next((facts[key] for key in ['職業', '所属・役割', '役割', '肩書き', '所属'] if facts.get(key)), '')
    profile['relationship'] = facts.get('あなたとの関係', '') or facts.get('関係', '') or facts.get('初期状態', '')
    mapping = {'外見': 'appearance', '容姿': 'appearance', '性格': 'personality', 'あなたとの関係': 'relationship'}
    # Use explicit published headings only. A general paragraph about a person
    # is retained in sections rather than guessed into appearance/personality.
    for section in character.get('sections', []):
        if section.get('title') in mapping:
            key = mapping[section['title']]
            profile[key] = '\n\n'.join(filter(None, [profile[key], section['text']]))
        if section.get('title') == '公開プロフィール':
            text = section['text']
            pattern = r'^(外見|容姿|性格|あなたとの関係|話し方|現在|好きなもの|嫌いなもの)\s*$'
            matches = list(re.finditer(pattern, text, re.M))
            for i, match in enumerate(matches):
                key = mapping.get(match[1])
                if key:
                    value = text[match.end():matches[i+1].start() if i+1 < len(matches) else len(text)].strip()
                    profile[key] = '\n\n'.join(filter(None, [profile[key], value]))
    return profile
