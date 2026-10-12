'use strict';
(() => {
  const data = window.ARCHIVE;
  const root = document.querySelector('#app');
  const page = document.body.dataset.page;
  const params = new URLSearchParams(location.search);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
  const imagePath = value => {
    const path = String(value || '');
    return /^(images|assets)\/[a-zA-Z0-9_./-]+$/.test(path) && !path.split('/').includes('..') ? path : '';
  };
  const works = data.works.filter(w => w.visible !== false);
  const characters = data.characters.filter(c => works.some(w => w.characters.includes(c.id)) && c.visible !== false);
  const findWork = id => works.find(w => w.id === id);
  const findCharacter = id => characters.find(c => c.id === id);
  const workLink = w => `work.html?id=${encodeURIComponent(w.id)}`;
  const characterLink = c => `character.html?id=${encodeURIComponent(c.id)}`;
  const destinations = work => (work.destinations || []).filter(d => d.status === 'published' && safeUrl(d.url));
  const themeColor = value => /^#[0-9a-f]{6}$/i.test(value) ? value : '#c3a477';
  const stats = window.ArchiveStats;
  const series = (data.series || []).filter(s => works.some(w => (w.series || []).includes(s.id)));
  const seriesFor = w => series.filter(s => (w.series || []).includes(s.id));
  const seriesLink = s => `series.html?id=${encodeURIComponent(s.id)}`;
  function talkCount(w) {
    const entry = stats.entry(w);
    return entry ? `<p class="talk-count">zeta · <strong>${esc(entry.label)}</strong> トーク</p>` : destinations(w).some(d=>d.name==='zeta') ? '<p class="talk-count">zeta · 集計待ち</p>' : '';
  }
  function seriesBadges(w) {
    return seriesFor(w).map(s => `<a class="badge series-badge" href="${seriesLink(s)}">${esc(s.name)} ↗</a>`).join('');
  }
  function seriesCard(s) {
    const members = works.filter(w => (w.series || []).includes(s.id));
    return `<a class="series-card" href="${seriesLink(s)}" style="--accent:${themeColor(s.color)}"><div class="series-covers" aria-hidden="true">${members.slice(0,3).map(w => `<img src="${esc(imagePath(w.cover))}" alt="" loading="lazy">`).join('')}</div><div class="series-body"><p class="eyebrow">SERIES / ${members.length} WORKS</p><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><span class="text-link">シリーズをひらく ↗</span></div></a>`;
  }
  function badges(work) {
    const published = destinations(work);
    return `<div class="badges">${published.length ? published.map(d => `<span class="badge platform">${esc(d.name)}</span>`).join('') : '<span class="badge">投稿先未登録</span>'}</div>`;
  }
  function workCard(w) {
    return `<article class="work-card" style="--accent:${themeColor(w.color)}"><a class="cover-link" href="${workLink(w)}"><img src="${esc(imagePath(w.cover))}" alt="${esc(w.title)}の表紙" loading="lazy" width="600" height="800"></a><div class="card-body"><div class="work-meta"><span>${esc(w.label)}</span><span>${esc(w.number)}</span></div><h3><a href="${workLink(w)}">${esc(w.title)}</a></h3><p>${esc(w.summary)}</p>${talkCount(w)}${badges(w)}<div class="badges">${seriesBadges(w)}</div></div></article>`;
  }
  function characterCard(c) {
    const image = imagePath(c.image);
    return `<a class="character-card" href="${characterLink(c)}">${image ? `<img class="character-icon" src="${esc(image)}" alt="${esc(c.name)}" loading="lazy">` : `<div class="character-icon" aria-hidden="true">${esc(c.name.slice(0,2))}</div>`}<h3>${esc(c.name)}</h3><p>${esc(c.reading || '')}</p><p class="character-card-lead">${esc(c.description)}</p><p class="character-card-facts">${[c.profile?.age ?? c.facts['年齢'],c.profile?.height || c.facts['身長'],c.profile?.occupation || c.facts['所属・役割'] || c.facts['役割']].filter(Boolean).map(esc).join(' / ')}</p><span class="text-link">人物資料を読む ↗</span></a>`;
  }
  function characterReference(c) {
    const image = imagePath(c.image);
    return `<a class="character-reference" href="${characterLink(c)}">${image ? `<img src="${esc(image)}" alt="" loading="lazy" width="56" height="56">` : '<span class="reference-placeholder" aria-hidden="true">人物</span>'}<span><strong>${esc(c.name)}</strong><small>${esc(c.reading || '')}</small></span><span class="reference-arrow" aria-hidden="true">↗</span></a>`;
  }
  function header() {
    const links = [['home','index.html','トップ'],['works','works.html','作品一覧'],['series','series.html','シリーズ'],['characters','characters.html','人物図鑑'],['diagnosis','diagnosis.html','おすすめ診断'],['worlds','worlds.html','世界観'],['about','about.html','作者について']];
    return `<a class="skip" href="#main">本文へ移動</a><header class="header"><div class="wrap header-inner"><a class="brand" href="index.html" aria-label="KACHIO ARCHIVE トップ"><img src="assets/logo.svg" alt="" width="37" height="43"><div><span class="brand-name">${esc(data.site.name)}</span><span class="brand-sub">ORIGINAL STORIES & CHARACTERS</span></div></a><button class="menu" aria-expanded="false" aria-controls="nav">メニュー</button><nav class="nav" id="nav" aria-label="メインメニュー">${links.map(([id,url,label]) => `<a href="${url}"${page === id || (page === 'work' && id === 'works') || (page === 'character' && id === 'characters') ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></div></header>${data.site.preview ? '<div class="preview"><div class="wrap">制作プレビュー · 公開作品の紹介・画像・投稿先リンクを登録済みです。</div></div>' : ''}`;
  }
  function footer() {
    return `<footer class="footer"><div class="wrap footer-inner"><span>© ${new Date().getFullYear()} ${esc(data.site.name)}<br>物語と、その世界に生きる人々の記録。</span><div class="footer-links"><a href="works.html">作品を探す</a><a href="about.html">このサイトについて</a><a href="#top">上へ ↑</a></div></div></footer>`;
  }
  function shell(content) {
    root.innerHTML = `${header()}<main id="main" class="wrap" tabindex="-1">${content}</main>${footer()}<dialog id="lightbox"><button class="close" type="button">閉じる ×</button><img alt=""><p class="gallery-caption"></p></dialog>`;
    const menu = document.querySelector('.menu');
    menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); document.querySelector('.nav').classList.toggle('open', open); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.setAttribute('aria-expanded', 'false'); document.querySelector('.nav').classList.remove('open'); } });
    const lightbox = document.querySelector('#lightbox');
    lightbox.querySelector('.close').addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
    document.querySelectorAll('[data-lightbox]').forEach(button => button.addEventListener('click', () => {
      const img = lightbox.querySelector('img');
      img.src = button.dataset.lightbox; img.alt = button.dataset.caption;
      lightbox.querySelector('p').textContent = button.dataset.caption; lightbox.showModal();
    }));
  }
  function heading(kicker,title,link = '') { return `<div class="section-head"><div><p class="eyebrow">${esc(kicker)}</p><h2>${esc(title)}</h2></div>${link}</div>`; }
  function home() {
    const featured = stats.ranked(works).filter(w => stats.entry(w)).slice(0,3);
    shell(`<section class="hero"><div><p class="eyebrow">THE STORIES, THE PEOPLE, THE WORLDS.</p><h1>物語をひらく。<br>彼らに、出会う。</h1><p class="hero-copy">創作した物語と、その世界に生きる人々の記録。<br>作品紹介から人物、舞台の設定まで。<br>あなたの気になる物語を、ここから。</p><a class="btn" href="works.html">作品を探す <span aria-hidden="true">↗</span></a></div><div class="hero-art" id="hero-covers" aria-label="zetaのトーク数が多い作品の表紙">${featured.map(w=>`<figure><a href="${workLink(w)}"><img src="${esc(imagePath(w.cover))}" alt="${esc(w.title)}の表紙" width="600" height="800"></a><figcaption>zeta / ${esc(stats.entry(w)?.label || '')} トーク</figcaption></figure>`).join('')}</div><span class="hero-foot">KACHIO ARCHIVE — A COLLECTION OF ORIGINAL WORKS</span></section><section class="section">${heading('ZETA / MOST TALKED','注目の物語','<a class="text-link" href="works.html?sort=talks">トーク数順で見る ↗</a>')}<p class="ranking-note" id="stats-note">${esc(stats.caption())}</p><div class="work-grid" id="featured-works">${featured.length ? featured.map(workCard).join('') : '<p class="empty">現在トーク数を確認できません。作品一覧からお楽しみください。</p>'}</div></section><section class="section">${heading('STORY COLLECTIONS','シリーズをたどる。','<a class="text-link" href="series.html">シリーズ一覧 ↗</a>')}<div class="series-grid">${series.map(seriesCard).join('')}</div></section><section class="section"><div class="explore"><div><p class="eyebrow">EXPLORE THE ARCHIVE</p><h2>好きな世界から、探す。</h2><p>ジャンルで選ぶ。人物からたどる。<br>物語への入口は、ひとつではありません。</p></div><div class="genre-list">${[...new Set(works.map(w=>w.genre))].map(g=>`<a href="works.html?genre=${encodeURIComponent(g)}">${esc(g)}<span>${String(works.filter(w=>w.genre===g).length).padStart(2,'0')}　↗</span></a>`).join('')}</div></div><div class="platform-note"><span>作品ごとのページから、各投稿先へ。</span><div class="badges">${data.platforms.map(p=>`<span class="badge">${esc(p)}</span>`).join('')}</div><span>投稿先は作品ごとに表示します。</span></div></section><section class="section diagnosis-invite"><div><p class="eyebrow">FIND YOUR STORY</p><h2>あなたに合う物語と、出会う。</h2><p>5つの質問から、気になる作品とキャラを見つけませんか。</p></div><a class="btn primary" href="diagnosis.html">おすすめ診断をはじめる ↗</a></section><section class="section">${heading('CHARACTER INDEX','人物から、物語へ。','<a class="text-link" href="characters.html">人物図鑑を見る ↗</a>')}<div class="character-grid">${['sagisawa','souichi','shizuma'].map(findCharacter).filter(Boolean).map(characterCard).join('')}</div></section>`);
    stats.subscribe(() => {
      const featured = stats.ranked(works).filter(w => stats.entry(w)).slice(0,3);
      document.querySelector('#featured-works').innerHTML = featured.map(workCard).join('');
      document.querySelector('#stats-note').textContent = stats.caption();
      document.querySelector('#hero-covers').innerHTML = featured.map(w => `<figure><a href="${workLink(w)}"><img src="${esc(imagePath(w.cover))}" alt="${esc(w.title)}の表紙" width="600" height="800"></a><figcaption>zeta / ${esc(stats.entry(w).label)} トーク</figcaption></figure>`).join('');
    });
  }
  function worksPage() {
    const genres = [...new Set(works.map(w=>w.genre))];
    const platforms = [...new Set([...data.platforms,...works.flatMap(w=>destinations(w).map(d=>d.name))])];
    shell(`<section class="page-intro"><p class="eyebrow">WORK INDEX</p><h1>作品一覧</h1><p>作品名、人物名、タグから、気になる物語を探す。</p></section><form class="tools" id="search-form" role="search"><label class="field">キーワード<input type="search" id="search" placeholder="作品名・人物名・シリーズ" autocomplete="off"></label><label class="field">シリーズ<select id="series"><option value="">すべてのシリーズ</option>${series.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><label class="field">ジャンル<select id="genre"><option value="">すべてのジャンル</option>${genres.map(g=>`<option>${esc(g)}</option>`).join('')}</select></label><label class="field">投稿先<select id="platform"><option value="">すべての投稿先</option>${platforms.map(p=>`<option>${esc(p)}</option>`).join('')}</select></label><label class="field">並び順<select id="sort"><option value="archive">掲載順</option><option value="talks">zetaのトーク数順</option></select></label></form><p class="result-count" id="count" aria-live="polite"></p><p class="ranking-note" id="sort-note"></p><section class="section" style="padding-top:28px"><div class="work-grid four" id="results"></div></section>`);
    const search = document.querySelector('#search'), genre = document.querySelector('#genre'), platform = document.querySelector('#platform'), seriesField = document.querySelector('#series'), sort = document.querySelector('#sort');
    search.value = params.get('q') || ''; genre.value = params.get('genre') || ''; platform.value = params.get('platform') || ''; seriesField.value = params.get('series') || ''; sort.value = params.get('sort') === 'talks' ? 'talks' : 'archive';
    function update() {
      const normalize = text => text.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s/g,'');
      const query = normalize(search.value.trim());
      let matches = works.filter(w => {
        const haystack = normalize([w.title,...destinations(w).map(d=>d.title || ''),w.summary,w.description,...w.story,w.genre,...w.tags,...seriesFor(w).map(s=>s.name),...w.characters.flatMap(id => { const c = findCharacter(id); return c ? [c.name,c.reading || '',...Object.values(c.facts),...Object.values(c.profile || {}),...(c.sections || []).map(s=>s.text)] : []; })].join(' '));
        return (!query || haystack.includes(query)) && (!genre.value || w.genre === genre.value) && (!platform.value || destinations(w).some(d=>d.name === platform.value)) && (!seriesField.value || (w.series || []).includes(seriesField.value));
      });
      if (sort.value === 'talks') matches = stats.ranked(matches);
      document.querySelector('#count').textContent = `${matches.length}作品 / 全${works.length}作品`;
      document.querySelector('#sort-note').textContent = sort.value === 'talks' ? stats.caption() + ' zeta未掲載の作品は末尾に表示します。' : '';
      document.querySelector('#results').innerHTML = matches.length ? matches.map(workCard).join('') : '<p class="empty">該当する作品はありません。検索条件を変えてみてください。</p>';
    }
    document.querySelector('#search-form').addEventListener('submit', e=>e.preventDefault());
    [search,genre,platform,seriesField,sort].forEach(field=>field.addEventListener('input',update));
    stats.subscribe(update); update();
  }
  function seriesPage() {
    const id = params.get('id');
    const selected = series.find(s => s.id === id);
    if (id && !selected) return missing('シリーズが見つかりません','series.html','シリーズ一覧へ');
    if (!selected) {
      shell(`<section class="page-intro"><p class="eyebrow">STORY COLLECTIONS</p><h1>シリーズ</h1><p>共通するテーマや舞台を持つ物語を、ひとまとまりに。</p></section><section class="section"><div class="series-grid">${series.map(seriesCard).join('')}</div></section>`);
      return;
    }
    const members = works.filter(w => (w.series || []).includes(selected.id));
    const people = characters.filter(c => members.some(w => w.characters.includes(c.id)));
    document.title = `${selected.name} | ${data.site.name}`;
    document.documentElement.style.setProperty('--accent',themeColor(selected.color));
    shell(`<div class="crumb"><a href="series.html">シリーズ</a> / ${esc(selected.name)}</div><section class="page-intro"><p class="eyebrow">SERIES / ${members.length} WORKS</p><h1>${esc(selected.name)}</h1><p>${esc(selected.description)}</p></section><section class="section series-intro">${(selected.sections || []).map(sectionContent).join('')}</section><section class="section">${heading('WORKS IN THIS SERIES','このシリーズの作品','<a class="text-link" href="works.html?series='+encodeURIComponent(selected.id)+'">絞り込んで探す ↗</a>')}<div class="work-grid" id="series-works">${members.map(workCard).join('')}</div></section><section class="section">${heading('PEOPLE IN THIS SERIES','登場人物')}<div class="character-grid">${people.map(characterCard).join('')}</div></section>`);
    stats.subscribe(() => { document.querySelector('#series-works').innerHTML = members.map(workCard).join(''); });
  }
  function detailSection(id, label, title, body) { return `<section class="detail-section" id="${id}"><p class="eyebrow">${esc(label)}</p><h2>${esc(title)}</h2>${body}</section>`; }
  function sectionContent(s) {
    if (s.visibility === 'private') return '';
    return `<div class="settings-block">${s.spoiler || s.collapsible ? `<details><summary>${esc(s.title)}${s.spoiler ? ' · ネタバレを読む' : 'を読む'}</summary><p>${esc(s.text)}</p></details>` : `<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>`}</div>`;
  }
  function missing(title, back, label) { shell(`<section class="page-intro"><p class="eyebrow">NOT FOUND</p><h1>${esc(title)}</h1><p>指定された資料が見つかりません。</p><a class="btn" href="${back}">${esc(label)} ↗</a></section>`); }
  function workPage() {
    const w = findWork(params.get('id')); if (!w) return missing('作品が見つかりません','works.html','作品一覧へ');
    document.title = `${w.title} | ${data.site.name}`;
    document.documentElement.style.setProperty('--accent',themeColor(w.color));
    const people = w.characters.map(findCharacter).filter(Boolean);
    const gallery = [{src:w.cover,caption:`${w.title} / 表紙`}].filter(g=>imagePath(g.src));
    const world = data.worlds.find(x=>x.id===w.world);
    const settings = (w.sections || []).filter(s=>s.visibility !== 'private' && s.title !== '登場人物の公開プロフィール');
    const related = [...new Set([...(w.related || []),...works.filter(x => x.id !== w.id && seriesFor(w).some(s => (x.series || []).includes(s.id))).map(x => x.id)])].map(findWork).filter(Boolean);
    const links = destinations(w);
    const alternateTitles = links.filter(d => d.title && d.title !== w.title).map(d => `<p class="gallery-caption">${esc(d.name)}での作品名：${esc(d.title)}</p>`).join('');
    const publicTexts = (w.publicTexts || []).filter(s=>s.visibility !== 'private');
    const sections = [['story','STORY','作品紹介'],...(publicTexts.length ? [['opening','INTRODUCTION','紹介と導入']] : []),...(people.length ? [['characters','CHARACTERS','登場人物']] : []),...(settings.length || world ? [['world','WORLD & NOTES','世界観・設定']] : []),...(gallery.length ? [['gallery','GALLERY','ギャラリー']] : []),...(related.length ? [['related','RELATED WORKS','関連作品']] : [])];
    shell(`<div class="crumb"><a href="works.html">作品一覧</a> / ${esc(w.title)}</div><section class="detail-hero"><img class="detail-cover" src="${esc(imagePath(w.cover))}" alt="${esc(w.title)}の表紙" width="600" height="800"><div><p class="eyebrow">FILE ${esc(w.number)} / ${esc(w.label)}</p><h1>${esc(w.title)}</h1><p class="detail-summary">${esc(w.summary)}</p><p class="detail-description">${esc(w.description)}</p><div class="badges"><span class="badge">${esc(w.genre)}</span>${seriesBadges(w)}${w.tags.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div>${links.length ? `<div class="destinations">${links.map((d,i)=>`<a class="btn${i===0?' primary':''}" href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener noreferrer">${esc(d.name)}で遊ぶ ↗</a>`).join('')}</div>` : '<p class="destination-empty">投稿先のリンクは、登録後にここへ表示します。</p>'}${alternateTitles}<div id="work-stat">${talkCount(w)}${stats.entry(w) ? `<p class="gallery-caption">${esc(stats.caption())}</p>` : ''}</div></div></section><nav class="tabs" aria-label="作品内の目次">${sections.map(([id,,title])=>`<a href="#${id}">${title}</a>`).join('')}</nav><div class="detail-layout"><aside class="side-index"><p class="eyebrow">CONTENTS / ${esc(w.number)}</p>${sections.map(([id,,title],i)=>`<a href="#${id}">${String(i+1).padStart(2,'0')}　${title}</a>`).join('')}<a href="works.html">← 作品一覧へ</a></aside><div>${detailSection('story','STORY','作品紹介',`<div class="prose">${w.story.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`)}${publicTexts.length ? detailSection('opening','INTRODUCTION','紹介と物語の導入',publicTexts.map(sectionContent).join('')) : ''}${people.length ? detailSection('characters','CHARACTERS','登場人物',`<div class="character-links">${people.map(characterReference).join('')}</div>`) : ''}${settings.length || world ? detailSection('world','WORLD & NOTES','世界観・設定',settings.map(sectionContent).join('')+(world ? `<a class="world-link" href="worlds.html?id=${encodeURIComponent(world.id)}"><span><strong>${esc(world.name)}</strong><small>${esc(world.description)}</small></span><span>資料を見る ↗</span></a>` : '')) : ''}${gallery.length ? detailSection('gallery','GALLERY','ギャラリー',`<div class="gallery single-cover">${gallery.map(g=>`<button type="button" data-lightbox="${esc(imagePath(g.src))}" data-caption="${esc(g.caption)}" aria-label="${esc(g.caption)}を拡大"><img src="${esc(imagePath(g.src))}" alt="${esc(g.caption)}" loading="lazy" width="600" height="800"></button>`).join('')}</div><p class="gallery-caption">画像を選ぶと拡大できます。</p>`) : ''}${related.length ? detailSection('related','RELATED WORKS','関連作品',`<div class="work-grid">${related.map(workCard).join('')}</div>`) : ''}</div></div>`);
    stats.subscribe(() => { document.querySelector('#work-stat').innerHTML = talkCount(w) + (stats.entry(w) ? `<p class="gallery-caption">${esc(stats.caption())}</p>` : ''); });
  }
  function charactersPage() {
    shell(`<section class="page-intro"><p class="eyebrow">CHARACTER INDEX</p><h1>人物図鑑</h1><p>それぞれの物語に生きる人々。</p></section><section class="section"><div class="character-grid">${characters.map(characterCard).join('')}</div></section>`);
  }
  function profileValue(value) { return value ? esc(value) : '<span class="profile-empty">未設定</span>'; }
  function characterProfile(c) {
    const profile = c.profile || {};
    const basic = [['名前',c.name],['読み',c.reading],['年齢',profile.age],['誕生日',profile.birthday],['身長',profile.height ?? c.facts['身長']],['職業',profile.occupation ?? c.facts['職業'] ?? c.facts['所属・役割']]];
    const main = [['容姿',profile.appearance],['性格',profile.personality],['口調',profile.speech],['あなた（user）との関係',profile.relationship]];
    const hidden = (c.behindSettings || []).filter(s => s.visibility !== 'private');
    return `<dl class="profile-basics">${basic.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${profileValue(value)}</dd></div>`).join('')}</dl><dl class="profile-narrative">${main.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${profileValue(value)}</dd></div>`).join('')}</dl><details class="behind-settings" id="behind-settings"><summary><span>裏設定</span><small>過去・秘密・恋愛の内面を、開いて読む</small></summary><div class="behind-settings-body">${hidden.length ? hidden.map(sectionContent).join('') : '<p class="profile-empty">裏設定はまだ掲載していません。</p>'}</div></details>`;
  }
  function characterPage() {
    const c = findCharacter(params.get('id')); if(!c) return missing('人物が見つかりません','characters.html','人物図鑑へ');
    const appearances = works.filter(w=>w.characters.includes(c.id));
    document.title = `${c.name} | ${data.site.name}`;
    if(appearances[0]) document.documentElement.style.setProperty('--accent',themeColor(appearances[0].color));
    shell(`<div class="crumb"><a href="characters.html">人物図鑑</a> / ${esc(c.name)}</div><article class="character-page"><p class="eyebrow">CHARACTER FILE</p>${imagePath(c.image) ? `<img class="character-portrait" src="${esc(imagePath(c.image))}" alt="${esc(c.name)}" width="256" height="341">` : ''}<h1>${esc(c.name)}</h1>${c.reading ? `<p class="reading">${esc(c.reading)}</p>` : ''}<p class="character-lead">${esc(c.description)}</p><div class="character-profile">${characterProfile(c)}</div></article><section class="section">${heading('APPEARANCES','登場する作品')}<div class="work-grid">${appearances.map(workCard).join('')}</div></section>`);
  }
  function worldsPage() {
    const id = params.get('id');
    const worlds = data.worlds.filter(x=>works.some(w=>w.world===x.id));
    const world = id ? worlds.find(x=>x.id===id) : null;
    if(id && !world) return missing('世界観が見つかりません','worlds.html','世界観一覧へ');
    if(world) {
      document.title = `${world.name} | ${data.site.name}`;
      shell(`<div class="crumb"><a href="worlds.html">世界観</a> / ${esc(world.name)}</div><section class="page-intro"><p class="eyebrow">${esc(world.label)}</p><h1>${esc(world.name)}</h1><p>${esc(world.description)}</p></section><section class="section">${world.sections.map(sectionContent).join('')}${world.credit ? `<p class="source-note">${esc(world.credit)}</p>` : ''}</section><section class="section">${heading('IN THIS WORLD','この世界の作品')}<div class="work-grid">${works.filter(w=>w.world===world.id).map(workCard).join('')}</div></section>`);
    } else shell(`<section class="page-intro"><p class="eyebrow">WORLDS & SETTINGS</p><h1>世界観・設定</h1><p>物語の舞台と、そこで息づく設定の記録。</p></section><section class="section"><div class="collection">${worlds.map(w=>`<a class="collection-card" href="worlds.html?id=${encodeURIComponent(w.id)}"><p class="eyebrow">${esc(w.label)}</p><h2>${esc(w.name)}</h2><p>${esc(w.description)}</p><p style="margin-top:25px">資料をひらく ↗</p></a>`).join('')}</div></section>`);
  }
  function diagnosisPage() {
    const engine = window.ArchiveRecommendations;
    if (!engine) return missing('診断を読み込めませんでした','index.html','トップへ');
    const questions = engine.questions;
    const answers = {};
    let step = 0;
    shell(`<section class="page-intro"><p class="eyebrow">FIND YOUR STORY</p><h1>作品・キャラのおすすめ診断</h1><p>今の好みを5つ選ぶと、あなたに合いそうな物語と人物をご紹介します。</p><p>作品の紹介とタグをもとに、好みに近い候補を選びます。</p></section><section class="diagnosis-section"><div id="diagnosis-panel" tabindex="-1"></div></section>`);
    const panel = document.querySelector('#diagnosis-panel');
    const focusPanel = () => { panel.focus(); };
    const reasonText = item => item.reasons.length ? item.reasons.slice(0,3).map(r=>`<span class="badge">${esc(r)}</span>`).join('') : '<span class="diagnosis-open-choice">条件を絞らずに選んだ候補</span>';
    function result() {
      const selected = engine.rank(data,answers);
      const note = !selected.total ? 'この条件に合う掲載作品はまだありません。回答を変えて試してください。' : selected.focused && !selected.hasMatch ? '好みに一致する紹介は見つかりませんでした。条件を絞らず、ほかの候補も見てみませんか。' : selected.focused ? '選んだ好みに近い作品と人物です。気になった相手から、物語をひらいてみてください。' : '幅広い好みから、まず出会ってほしい作品と人物を選びました。';
      const workItems = selected.focused && selected.hasMatch ? selected.works.filter(r=>r.score>0) : selected.works;
      const characterItems = selected.focused && selected.hasMatch ? selected.characters.filter(r=>r.score>0) : selected.characters;
      panel.innerHTML=`<div class="diagnosis-result-head"><p class="eyebrow">YOUR STORY PICKS</p><h2>あなたにおすすめの物語</h2><p>${note}</p><div class="diagnosis-answer-list">${questions.map(q=>`<span>${esc(q.choices.find(c=>c.id===answers[q.id])?.label || '')}</span>`).join('')}</div></div>${workItems.length ? `<section class="diagnosis-result-section"><h3>おすすめの作品</h3><div class="diagnosis-work-results">${workItems.map(item=>`<article class="diagnosis-work"><a class="diagnosis-result-cover" href="${workLink(item.work)}"><img src="${esc(imagePath(item.work.cover))}" alt="${esc(item.work.title)}の表紙" loading="lazy" width="600" height="800"></a><div><p class="eyebrow">${esc(item.work.genre)}</p><h4><a href="${workLink(item.work)}">${esc(item.work.title)}</a></h4><p>${esc(item.work.summary)}</p><div class="diagnosis-reasons"><small>選んだ好みとの共通点</small><div class="badges">${reasonText(item)}</div></div><a class="text-link" href="${workLink(item.work)}">作品を読む ↗</a></div></article>`).join('')}</div></section>` : ''}${characterItems.length ? `<section class="diagnosis-result-section"><h3>気になりそうなキャラ</h3><div class="diagnosis-character-results">${characterItems.map(item=>`<article class="diagnosis-character">${characterReference(item.character)}<p>${esc(item.character.description)}</p><div class="diagnosis-reasons"><small>選んだ好みとの共通点</small><div class="badges">${reasonText(item)}</div></div><a class="diagnosis-appearance" href="${workLink(item.work)}">登場作品：${esc(item.work.title)} ↗</a></article>`).join('')}</div></section>` : ''}<div class="diagnosis-actions"><button class="btn" id="diagnosis-adjust" type="button">回答を見直す</button><button class="btn primary" id="diagnosis-restart" type="button">もう一度診断する</button></div>`;
      document.querySelector('#diagnosis-adjust').addEventListener('click',()=>{step=0;question();focusPanel();});
      document.querySelector('#diagnosis-restart').addEventListener('click',()=>{Object.keys(answers).forEach(key=>delete answers[key]);step=0;question();focusPanel();});
    }
    function question() {
      const q=questions[step];
      panel.innerHTML=`<div class="diagnosis-progress"><span>QUESTION ${String(step+1).padStart(2,'0')} / ${String(questions.length).padStart(2,'0')}</span><span>${step+1} / ${questions.length}問</span></div><div class="diagnosis-meter" aria-hidden="true"><span style="width:${(step+1)/questions.length*100}%"></span></div><form id="diagnosis-form"><fieldset class="diagnosis-question"><legend>${esc(q.title)}</legend><p>${esc(q.hint)}</p><div class="diagnosis-choices">${q.choices.map(c=>`<label class="diagnosis-choice"><input type="radio" name="${q.id}" value="${c.id}" required${answers[q.id]===c.id?' checked':''}><span><strong>${esc(c.label)}</strong><small>${esc(c.description)}</small></span></label>`).join('')}</div></fieldset><div class="diagnosis-actions"><button class="btn" id="diagnosis-back" type="button"${step===0?' disabled':''}>前の質問へ</button><button class="btn primary" id="diagnosis-next" type="submit"${answers[q.id]?'':' disabled'}>${step===questions.length-1?'診断結果を見る':'次の質問へ'}</button></div></form>`;
      const form=document.querySelector('#diagnosis-form');
      form.addEventListener('change',event=>{
        if(event.target.name===q.id && q.choices.some(c=>c.id===event.target.value)) {
          answers[q.id]=event.target.value;
          document.querySelector('#diagnosis-next').disabled=false;
        }
      });
      form.addEventListener('submit',event=>{
        event.preventDefault();if(!answers[q.id]) return;
        if(step===questions.length-1) result();else{step++;question();}
        focusPanel();
      });
      document.querySelector('#diagnosis-back').addEventListener('click',()=>{if(step>0){step--;question();focusPanel();}});
    }
    question();
  }
  function about() {
    shell(`<section class="page-intro"><p class="eyebrow">ABOUT THE ARCHIVE</p><h1>この場所について</h1></section><section class="section"><img class="about-logo" src="assets/logo.svg" alt="KACHIO ARCHIVE ロゴ"><h2 class="serif">${esc(data.site.name)}</h2><div class="prose" style="margin-top:25px"><p>物語と、その世界に生きる人々の記録。</p><p>創作作品、キャラクター、世界観をまとめた個人の作品資料集です。気になる作品を見つけたら、作品ページから各投稿先へ進めます。</p><p>小説を書くことと、お絵描きが好きです。</p></div><p class="legal">掲載している画像・文章の無断転載はご遠慮ください。</p></section><section class="section"><a class="btn" href="works.html">作品を探す ↗</a></section>`);
  }
  ({home,works:worksPage,work:workPage,series:seriesPage,characters:charactersPage,character:characterPage,diagnosis:diagnosisPage,worlds:worldsPage,about}[page] || home)();
})();
