'use strict';
(() => {
  const questions = [
    {id:'world',title:'どんな世界に入りたい？',hint:'今、惹かれる舞台を選んでください。',choices:[['daily','身近な日常','隣人や穏やかな暮らし'],['underworld','裏社会','ヤクザや組織の世界'],['uncanny','怪異・不思議','広告怪異、神様、説明のつかない存在'],['fantasy','異能・未来','異能やアンドロイドのいる世界'],['stage','アイドル・接客','ステージやカフェの舞台裏'],['any','どれも気になる','世界観にはこだわらない']]},
    {id:'mood',title:'どんな空気を楽しみたい？',hint:'今日読みたい物語の雰囲気は？',choices:[['gentle','穏やかで優しい','気遣いや、落ち着いたやり取り'],['banter','軽口や掛け合い','煽り、冗談、返しを楽しみたい'],['mystery','不穏さや謎','少しずつ違和感を知りたい'],['intense','重い愛情や執着','強い感情を感じたい'],['any','決めずに出会いたい','幅広く見てみたい']]},
    {id:'personality',title:'どんな相手が気になる？',hint:'キャラの性格から選んでください。',choices:[['serious','真面目で責任感がある','知的、几帳面、礼儀正しい'],['caring','面倒見がよく世話焼き','頼れる、優しい、気配り上手'],['cheeky','生意気で軽口が多い','からかい合う距離が好き'],['elusive','本心が掴みにくい','胡散臭さ、皮肉、読めない表情'],['any','性格にはこだわらない','新しい好みに出会いたい']]},
    {id:'relationship',title:'どんな関係から始めたい？',hint:'物語の入口になる距離感を選んでください。',choices:[['group','複数の相手と出会う','マルチキャラの作品を遊びたい'],['close','隣人・恋人の近い距離','暮らしの中で関わりたい'],['work','職場・仕事・師弟','仕事を通して関係を育てたい'],['first','新しい出会い','初対面や接続から始めたい'],['tension','敵対やすれ違い','最初から素直になれない関係'],['any','関係は決めずに探す','いろいろな入口を見たい']]},
    {id:'play',title:'どんな遊び方で探す？',hint:'掲載されているタグに合わせて候補を選びます。',choices:[['any','どちらも含めて探す','恋愛の形式にはこだわらない'],['nl','NLを中心に探す','男女の恋愛を想定して探す'],['bl','BLを中心に探す','男性同士の恋愛を想定して探す'],['conversation','会話や世界観を中心に','日常や仕事のやり取りから探す']]}
  ].map(q=>({...q,choices:q.choices.map(([id,label,description])=>({id,label,description}))}));

  const rules = {
    world:{daily:/日常|人間ドラマ|探偵/,underworld:/ヤクザ|裏社会/,uncanny:/ホラー|怪異|神様|和風ファンタジー/,fantasy:/異能|現代ファンタジー|アンドロイド|SF/,stage:/アイドル|カフェ|接客/},
    mood:{gentle:/穏やか|優し|甘やか|安心|柔らか|面倒見|世話|気遣/,banter:/軽口|冗談|ツッコミ|煽|からか|生意気|悪戯|チャラ|メスガキ/,mystery:/ホラー|不穏|怪異|謎|胡散|掴みどころ|暗示/,intense:/執着|溺愛|独占|過保護/},
    personality:{serious:/責任感|知的|几帳面|礼儀|真面目|冷静|堅物|頑固|紳士|有能|実力派/,caring:/面倒見|世話|優し|気配り|気遣|甘やか|見守|親切|サポート/,cheeky:/生意気|軽口|煽|悪戯|からか|ツッコミ|冗談|チャラ/,elusive:/胡散|掴みどころ|皮肉|本心|冷笑|読みにく|無表情|飄々/},
    relationship:{close:/隣人|隣室|隣の部屋|恋人|同棲|彼氏/,work:/仕事|職場|助手|新人|先輩|マネージャー|社員|探偵|会社員/,first:/初対面|初めて|出会|迷い込|接続|繋が/,tension:/敵対|宿敵|政略|皮肉|板挟|ぎこちな|突き放|憎しみ/}
  };
  const weights={world:6,mood:4,personality:5,relationship:4};
  const visible = record => record.visible !== false;
  const strings = values => values.filter(v=>typeof v==='string').join('\n');
  const workText = w => strings([w.genre,...(w.tags||[]),w.summary,w.description,...(w.story||[])]);
  const characterText = c => strings([c.description,c.profile?.personality,c.profile?.relationship,c.profile?.occupation,c.profile?.speech]);
  const matches = (axis,text) => Object.entries(rules[axis]).filter(([,pattern])=>pattern.test(text)).map(([id])=>id);
  function traits(w,c) {
    const peopleText=c?characterText(c):'';
    const worldText=strings([w.genre,...(w.tags||[])]);
    const moodText=strings([worldText,w.summary,w.description,c?.description,c?.profile?.personality]);
    const relationshipText=strings([w.title,w.summary,w.description,...(w.story||[]),c?.profile?.relationship,c?.profile?.occupation]);
    return {world:matches('world',worldText),mood:matches('mood',moodText),personality:matches('personality',peopleText),relationship:[...matches('relationship',relationshipText),...((w.characters||[]).length>1?['group']:[])]};
  }
  function validAnswers(answers) {
    if(!answers||typeof answers!=='object') throw new Error('回答を確認してください。');
    for(const [key,value] of Object.entries(answers)) {
      const q=questions.find(q=>q.id===key);
      if(!q||!q.choices.some(c=>c.id===value)) throw new Error('回答を確認してください。');
    }
  }
  function supports(w,play) {
    if(play!=='nl'&&play!=='bl') return true;
    const tags=(w.tags||[]).map(t=>String(t).toLowerCase());
    return tags.includes(play)||tags.some(t=>t.includes('nlでもblでも'));
  }
  function score(traits,answers,w) {
    let total=0;const reasons=[];
    for(const q of questions) {
      const id=answers[q.id];
      if(id&&id!=='any'&&traits[q.id]?.includes(id)) {
        total+=weights[q.id];reasons.push(q.choices.find(c=>c.id===id).label);
      }
    }
    if(answers.play==='conversation'&&/日常|人間ドラマ|探偵|お仕事|アイドル|カフェ/.test(strings([w.genre,...(w.tags||[])]))) {
      total+=3;reasons.push('会話や世界観を中心に');
    }
    return {score:total,reasons};
  }
  function rank(archive,answers={}) {
    validAnswers(answers);
    const people=(archive.characters||[]).filter(visible);
    const works=(archive.works||[]).filter(w=>visible(w)&&supports(w,answers.play)&&(!answers.world||answers.world==='any'||traits(w,null).world.includes(answers.world)));
    const workResults=[];const characterResults=[];
    for(const w of works) {
      const cast=people.filter(c=>(w.characters||[]).includes(c.id));
      const profiles=cast.map(c=>({character:c,work:w,...score(traits(w,c),answers,w)}));
      for(const candidate of profiles) characterResults.push(candidate);
      const own=traits(w,null);
      own.personality=[...new Set(cast.flatMap(c=>matches('personality',characterText(c))))];
      own.mood=[...new Set([...own.mood,...cast.flatMap(c=>matches('mood',strings([c.description,c.profile?.personality])))])];
      workResults.push({work:w,...score(own,answers,w)});
    }
    const order=(a,b)=>b.score-a.score||b.reasons.length-a.reasons.length;
    workResults.sort(order);characterResults.sort(order);
    const uniqueCharacters=characterResults.filter((candidate,i,all)=>all.findIndex(x=>x.character.id===candidate.character.id)===i);
    const focused=questions.some(q=>q.id!=='play'&&answers[q.id]&&answers[q.id]!=='any')||answers.play==='conversation';
    return {works:workResults.slice(0,3),characters:uniqueCharacters.slice(0,3),focused,hasMatch:workResults.some(r=>r.score>0)||uniqueCharacters.some(r=>r.score>0),total:works.length};
  }
  window.ArchiveRecommendations={questions,rank};
})();
