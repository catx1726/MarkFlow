/* 舞台页面 i18n：?lang=en 切换英文（默认中文，HTML 直出中文，本脚本整树替换文案）。
   须在 rec.js 之前加载：rec.js 只改 pager 链接 href，不动文本。 */
;(() => {
  const lang = new URLSearchParams(location.search).get('lang')
  if (lang !== 'en') return

  const KICKER = 'The rhythm of film is a heartbeat · Bresson notes'
  /* 篇间链接文案按「目标文件」映射（同一句在所有页面复用） */
  const LINKS = {
    'a.html': '← Prev · Let the Inner Lead',
    'b.html': 'Next · A Film of Hands, Objects, and Glances →',
    'd.html': 'Next · Poetry and Truth Are Sisters →',
  }
  const T = {
    a: {
      title: 'Let the Inner Lead',
      paras: [
        'Let the inner life lead. I know how contradictory that sounds in an art entirely devoted to the external. I have seen films in which everyone keeps running, yet the rhythm stays slow; and films whose characters barely move, yet the rhythm is fast. The rhythm of images cannot cure an inner slowness.',
        "Only the forming and resolving of a character's inner knot can bring movement to a film — true movement. That is the movement I try to show: through things and their combinations, not merely through dialogue.",
        'In truth, cinema is a walk toward the unknown. That is its beauty, and my pursuit. The audience should feel that I am walking into the unknown.',
        'In film we must have a feeling of discovering people, a profound discovery. The work rests on nature, on the human being, not on the actor. We should return to nature.',
      ],
    },
    b: {
      title: 'A Film of Hands, Objects, and Glances',
      paras: [
        'I want to make a film about hands, objects, and glances, and I refuse everything theatrical. Theatre killed cinema, and cinema killed theatre. What cinema needs is the human being.',
        'Actors — even, especially, the most gifted — show us an image of people too simple to be true. What matters is not what performers reveal to me, but what they hide.',
        "In real life, three quarters of our actions and even our words are unconscious. Through this 'automatism' I try to reach the true. I do not ask performers to fabricate truth. I ask them to make certain gestures, say certain words — not true in themselves, but done and said for the sake of truth.",
        'Rhythm comes from precision: a thing is so, or it is not; a thing sits in its rightful place, or it does not; a thing has the right size, or it does not.',
        'I always look at a detail with the whole in view.',
      ],
    },
    d: {
      title: 'Poetry and Truth Are Sisters',
      paras: [
        "People don't know that creation begins with cutting and stripping away. That also means choosing. For a film, the worst trap is clutter, excess, and disorder — too many incompatible things appearing at once.",
        'I try to capture truth, fragments of truth as pure as possible. Then I arrange these fragments in a certain order.',
        'Poetry and truth are sisters. Poetry on screen does not arise from poetic images or texts — it comes from true details, or more precisely, from the combination of true details.',
        'Editing is putting things back in place: every visual and sound element set at its exact position. Then we should make these elements look as if they never want to be apart.',
        "I believe in automatism. I ask only one thing of performers: 'Don't think about what you are doing, don't think about what you are saying.' Without order, without measure, there is no emotion.",
      ],
    },
  }[document.body.dataset.page]
  if (!T) return

  document.documentElement.lang = 'en'
  document.title = T.title
  document.querySelector('.kicker').textContent = KICKER
  document.querySelector('h1').textContent = T.title
  T.paras.forEach((t, i) => {
    const p = document.querySelector(`[data-para="${i}"]`)
    if (p) p.textContent = t
  })
  document.querySelectorAll('.pager a').forEach(a => {
    const file = a.getAttribute('href').split('?')[0].replace('./', '')
    /* b 页指向 a/d 的链接共两条，文案按目标区分；指向 b 的只有 a 页一条 */
    if (file === 'b.html' && document.body.dataset.page === 'd') a.textContent = LINKS['b.html'].replace('Next', '← Prev').replace(' →', '')
    else a.textContent = LINKS[file] || a.textContent
  })
})()
