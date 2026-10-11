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
  function badges(work) {
    const published = destinations(work);
    return `<div class="badges">${published.length ? published.map(d => `<span class="badge platform">${esc(d.name)}</span>`).join('') : '<span class="badge">投稿先未登録</span>'}</div>`;
  }
  function workCard(w) {
    return `<article class="work-card" style="--accent:${themeColor(w.color)}"><a class="cover-link" href="${workLink(w)}"><img src="${esc(imagePath(w.cover))}" alt="${esc(w.title)}の表紙" loading="lazy" width="600" height="800"></a><div class="card-body"><div class="work-meta"><span>${esc(w.label)}</span><span>${esc(w.number)}</span></div><h3><a href="${workLink(w)}">${esc(w.title)}</a></h3><p>${esc(w.summary)}</p>${badges(w)}</div></article>`;
  }
  function characterCard(c) {
    const image = imagePath(c.image);
    return `<a class="character-card" href="${characterLink(c)}">${image ? `<img class="character-icon" src="${esc(image)}" alt="${esc(c.name)}" loading="lazy">` : `<div class="character-icon" aria-hidden="true">${esc(c.name.slice(0,2))}</div>`}<h3>${esc(c.name)}</h3><p>${esc(c.reading || '人物資料を見る')} <span aria-hidden="true">↗</span></p></a>`;
  }
  function header() {
    const links = [['home','index.html','トップ'],['works','works.html','作品一覧'],['characters','characters.html','人物図鑑'],['worlds','worlds.html','世界観'],['about','about.html','作者について']];
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
    const featured = works.filter(w => w.featured).slice(0,3);
    shell(`<section class="hero"><div><p class="eyebrow">THE STORIES, THE PEOPLE, THE WORLDS.</p><h1>物語をひらく。<br>彼らに、出会う。</h1><p class="hero-copy">創作した物語と、その世界に生きる人々の記録。<br>作品紹介から人物、舞台の設定まで。<br>あなたの気になる物語を、ここから。</p><a class="btn" href="works.html">作品を探す <span aria-hidden="true">↗</span></a></div><div class="hero-art" aria-label="注目作品の表紙">${featured.map(w=>`<figure><a href="${workLink(w)}"><img src="${esc(imagePath(w.cover))}" alt="${esc(w.title)}の表紙" width="600" height="800"></a><figcaption>FILE ${esc(w.number)} / ${esc(w.label)}</figcaption></figure>`).join('')}</div><span class="hero-foot">KACHIO ARCHIVE — A COLLECTION OF ORIGINAL WORKS</span></section><section class="section">${heading('SELECTED WORKS','注目の物語','<a class="text-link" href="works.html">すべての作品を見る ↗</a>')}<div class="work-grid">${featured.map(workCard).join('')}</div></section><section class="section"><div class="explore"><div><p class="eyebrow">EXPLORE THE ARCHIVE</p><h2>好きな世界から、探す。</h2><p>ジャンルで選ぶ。人物からたどる。<br>物語への入口は、ひとつではありません。</p></div><div class="genre-list">${[...new Set(works.map(w=>w.genre))].map(g=>`<a href="works.html?genre=${encodeURIComponent(g)}">${esc(g)}<span>${String(works.filter(w=>w.genre===g).length).padStart(2,'0')}　↗</span></a>`).join('')}</div></div><div class="platform-note"><span>作品ごとのページから、各投稿先へ。</span><div class="badges">${data.platforms.map(p=>`<span class="badge">${esc(p)}</span>`).join('')}</div><span>投稿先は作品ごとに表示します。</span></div></section><section class="section">${heading('CHARACTER INDEX','人物から、物語へ。','<a class="text-link" href="characters.html">人物図鑑を見る ↗</a>')}<div class="character-grid">${['sagisawa','souichi','shizuma'].map(findCharacter).filter(Boolean).map(characterCard).join('')}</div></section>`);
  }
  function worksPage() {
    const genres = [...new Set(works.map(w=>w.genre))];
    const platforms = [...new Set([...data.platforms,...works.flatMap(w=>destinations(w).map(d=>d.name))])];
    shell(`<section class="page-intro"><p class="eyebrow">WORK INDEX</p><h1>作品一覧</h1><p>作品名、人物名、タグから、気になる物語を探す。</p></section><form class="tools" id="search-form" role="search"><label class="field">キーワード<input type="search" id="search" placeholder="作品名・人物名・タグ" autocomplete="off"></label><label class="field">ジャンル<select id="genre"><option value="">すべてのジャンル</option>${genres.map(g=>`<option>${esc(g)}</option>`).join('')}</select></label><label class="field">投稿先<select id="platform"><option value="">すべての投稿先</option>${platforms.map(p=>`<option>${esc(p)}</option>`).join('')}</select></label></form><p class="result-count" id="count" aria-live="polite"></p><section class="section" style="padding-top:28px"><div class="work-grid four" id="results"></div></section>`);
    const search = document.querySelector('#search'), genre = document.querySelector('#genre'), platform = document.querySelector('#platform');
    search.value = params.get('q') || ''; genre.value = params.get('genre') || ''; platform.value = params.get('platform') || '';
    function update() {
      const normalize = text => text.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s/g,'');
      const query = normalize(search.value.trim());
      const matches = works.filter(w => {
        const haystack = normalize([w.title,...destinations(w).map(d=>d.title || ''),w.summary,w.description,w.genre,...w.tags,...w.characters.map(id=>findCharacter(id)?.name || ''),...w.characters.map(id=>findCharacter(id)?.reading || '')].join(' '));
        return (!query || haystack.includes(query)) && (!genre.value || w.genre === genre.value) && (!platform.value || destinations(w).some(d=>d.name === platform.value));
      });
      document.querySelector('#count').textContent = `${matches.length}作品 / 全${works.length}作品`;
      document.querySelector('#results').innerHTML = matches.length ? matches.map(workCard).join('') : '<p class="empty">該当する作品はありません。検索条件を変えてみてください。</p>';
    }
    document.querySelector('#search-form').addEventListener('submit', e=>e.preventDefault());
    [search,genre,platform].forEach(field=>field.addEventListener('input',update)); update();
  }
  function detailSection(id, label, title, body) { return `<section class="detail-section" id="${id}"><p class="eyebrow">${esc(label)}</p><h2>${esc(title)}</h2>${body}</section>`; }
  function sectionContent(s) {
    if (s.visibility === 'private') return '';
    return `<div class="settings-block">${s.spoiler ? `<details><summary>${esc(s.title)} · ネタバレを読む</summary><p>${esc(s.text)}</p></details>` : `<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>`}</div>`;
  }
  function missing(title, back, label) { shell(`<section class="page-intro"><p class="eyebrow">NOT FOUND</p><h1>${esc(title)}</h1><p>指定された資料が見つかりません。</p><a class="btn" href="${back}">${esc(label)} ↗</a></section>`); }
  function workPage() {
    const w = findWork(params.get('id')); if (!w) return missing('作品が見つかりません','works.html','作品一覧へ');
    document.title = `${w.title} | ${data.site.name}`;
    document.documentElement.style.setProperty('--accent',themeColor(w.color));
    const people = w.characters.map(findCharacter).filter(Boolean);
    const gallery = [{src:w.cover,caption:`${w.title} / 表紙`},...(w.gallery || []).filter(g=>g.visibility !== 'private')].filter(g=>imagePath(g.src));
    const world = data.worlds.find(x=>x.id===w.world);
    const settings = (w.sections || []).filter(s=>s.visibility !== 'private');
    const related = (w.related || []).map(findWork).filter(Boolean);
    const links = destinations(w);
    const alternateTitles = links.filter(d => d.title && d.title !== w.title).map(d => `<p class="gallery-caption">${esc(d.name)}での作品名：${esc(d.title)}</p>`).join('');
    const sections = [['story','STORY','作品紹介'],...(people.length ? [['characters','CHARACTERS','登場人物']] : []),...(settings.length || world ? [['world','WORLD & NOTES','世界観・設定']] : []),...(gallery.length ? [['gallery','GALLERY','ギャラリー']] : []),...(related.length ? [['related','RELATED WORKS','関連作品']] : [])];
    shell(`<div class="crumb"><a href="works.html">作品一覧</a> / ${esc(w.title)}</div><section class="detail-hero"><img class="detail-cover" src="${esc(imagePath(w.cover))}" alt="${esc(w.title)}の表紙" width="600" height="800"><div><p class="eyebrow">FILE ${esc(w.number)} / ${esc(w.label)}</p><h1>${esc(w.title)}</h1><p class="detail-summary">${esc(w.summary)}</p><p class="detail-description">${esc(w.description)}</p><div class="badges"><span class="badge">${esc(w.genre)}</span>${w.tags.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}</div>${links.length ? `<div class="destinations">${links.map((d,i)=>`<a class="btn${i===0?' primary':''}" href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener noreferrer">${esc(d.name)}で遊ぶ ↗</a>`).join('')}</div>` : '<p class="destination-empty">投稿先のリンクは、登録後にここへ表示します。</p>'}${alternateTitles}</div></section><nav class="tabs" aria-label="作品内の目次">${sections.map(([id,,title])=>`<a href="#${id}">${title}</a>`).join('')}</nav><div class="detail-layout"><aside class="side-index"><p class="eyebrow">CONTENTS / ${esc(w.number)}</p>${sections.map(([id,,title],i)=>`<a href="#${id}">${String(i+1).padStart(2,'0')}　${title}</a>`).join('')}<a href="works.html">← 作品一覧へ</a></aside><div>${detailSection('story','STORY','作品紹介',`<div class="prose">${w.story.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`)}${people.length ? detailSection('characters','CHARACTERS','登場人物',`<div class="character-grid">${people.map(characterCard).join('')}</div>`) : ''}${settings.length || world ? detailSection('world','WORLD & NOTES','世界観・設定',settings.map(sectionContent).join('')+(world ? `<a class="world-link" href="worlds.html?id=${encodeURIComponent(world.id)}">${esc(world.name)}の資料を見る <span>↗</span></a>` : '')) : ''}${gallery.length ? detailSection('gallery','GALLERY','ギャラリー',`<div class="gallery">${gallery.map(g=>`<button type="button" data-lightbox="${esc(imagePath(g.src))}" data-caption="${esc(g.caption)}" aria-label="${esc(g.caption)}を拡大"><img src="${esc(imagePath(g.src))}" alt="${esc(g.caption)}" loading="lazy" width="600" height="800"></button>`).join('')}</div><p class="gallery-caption">画像を選ぶと拡大できます。</p>`) : ''}${related.length ? detailSection('related','RELATED WORKS','関連作品',`<div class="work-grid">${related.map(workCard).join('')}</div>`) : ''}</div></div>`);
  }
  function charactersPage() {
    shell(`<section class="page-intro"><p class="eyebrow">CHARACTER INDEX</p><h1>人物図鑑</h1><p>それぞれの物語に生きる人々。</p></section><section class="section"><div class="character-grid">${characters.map(characterCard).join('')}</div></section>`);
  }
  function characterPage() {
    const c = findCharacter(params.get('id')); if(!c) return missing('人物が見つかりません','characters.html','人物図鑑へ');
    const appearances = works.filter(w=>w.characters.includes(c.id));
    document.title = `${c.name} | ${data.site.name}`;
    if(appearances[0]) document.documentElement.style.setProperty('--accent',themeColor(appearances[0].color));
    shell(`<div class="crumb"><a href="characters.html">人物図鑑</a> / ${esc(c.name)}</div><article class="character-page"><p class="eyebrow">CHARACTER FILE</p>${imagePath(c.image) ? `<img class="character-portrait" src="${esc(imagePath(c.image))}" alt="${esc(c.name)}" width="256" height="341">` : ""}<h1>${esc(c.name)}</h1>${c.reading?`<p class="reading">${esc(c.reading)}</p>`:''}<p class="character-lead">${esc(c.description)}</p>${Object.keys(c.facts).length ? `<dl class="facts">${Object.entries(c.facts).map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}${(c.sections||[]).map(sectionContent).join('')}${(c.sections||[]).length ? '' : '<p class="legal">詳しいプロフィールと画像は、今後追加予定です。</p>'}</article><section class="section">${heading('APPEARANCES','登場する作品')}<div class="work-grid">${appearances.map(workCard).join('')}</div></section>`);
  }
  function worldsPage() {
    const id = params.get('id');
    const worlds = data.worlds.filter(x=>works.some(w=>w.world===x.id));
    const world = id ? worlds.find(x=>x.id===id) : null;
    if(id && !world) return missing('世界観が見つかりません','worlds.html','世界観一覧へ');
    if(world) {
      document.title = `${world.name} | ${data.site.name}`;
      shell(`<div class="crumb"><a href="worlds.html">世界観</a> / ${esc(world.name)}</div><section class="page-intro"><p class="eyebrow">${esc(world.label)}</p><h1>${esc(world.name)}</h1><p>${esc(world.description)}</p></section><section class="section">${world.sections.map(sectionContent).join('')}</section><section class="section">${heading('IN THIS WORLD','この世界の作品')}<div class="work-grid">${works.filter(w=>w.world===world.id).map(workCard).join('')}</div></section>`);
    } else shell(`<section class="page-intro"><p class="eyebrow">WORLDS & SETTINGS</p><h1>世界観・設定</h1><p>物語の舞台と、そこで息づく設定の記録。</p></section><section class="section"><div class="collection">${worlds.map(w=>`<a class="collection-card" href="worlds.html?id=${encodeURIComponent(w.id)}"><p class="eyebrow">${esc(w.label)}</p><h2>${esc(w.name)}</h2><p>${esc(w.description)}</p><p style="margin-top:25px">資料をひらく ↗</p></a>`).join('')}</div></section>`);
  }
  function about() {
    shell(`<section class="page-intro"><p class="eyebrow">ABOUT THE ARCHIVE</p><h1>この場所について</h1></section><section class="section"><img class="about-logo" src="assets/logo.svg" alt="KACHIO ARCHIVE ロゴ"><h2 class="serif">${esc(data.site.name)}</h2><div class="prose" style="margin-top:25px"><p>物語と、その世界に生きる人々の記録。</p><p>創作作品、キャラクター、世界観をまとめた個人の作品資料集です。気になる作品を見つけたら、作品ページから各投稿先へ進めます。</p><p>小説を書くことと、お絵描きが好きです。</p></div><p class="legal">掲載している画像・文章の無断転載はご遠慮ください。</p></section><section class="section"><a class="btn" href="works.html">作品を探す ↗</a></section>`);
  }
  ({home,works:worksPage,work:workPage,characters:charactersPage,character:characterPage,worlds:worldsPage,about}[page] || home)();
})();
