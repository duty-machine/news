let Parser = require('rss-parser')
let fs = require('fs')
let querystring = require('querystring')
let urlMod = require('url')
let URL = urlMod.URL

let feedxUrls = {
  '路透': 'https://feedx.net/rss/reuters.xml',
  '纽约时报': 'https://feedx.net/rss/nytimes.xml',
  '美国之音': 'https://feedx.net/rss/mgzy1.xml',
  '金融时报': 'https://feedx.net/rss/ft.xml',
  'BBC': 'https://feedx.net/rss/bbc.xml',
  '法广': 'https://feedx.net/rss/rfi.xml',
  '德国之声': 'https://feedx.net/rss/dw.xml'
}

async function fetchArticles(site) {

  let articles
  if (feedxUrls[site]) {
    articles = await fetchFeedx(site, feedxUrls[site])
  } else if (site == '中国数字时代') {
    articles = await fetchCDT()
  }

  articles.sort((x, y) => x.pubDate - y.pubDate)

  return articles
}

async function fetchFeedx(site, url) {
  let parser = new Parser()
  let feed = await parser.parseURL(url)

  return feed.items.map(item => {
    return {
      title: item.title,
      content: item.content,
      link: item.link,
      pubDate: Date.parse(item.pubDate),
      site: site
    }
  })
}

async function fetchCDT() {
  let parser = new Parser()
  let feed = await parser.parseURL('https://chinadigitaltimes.net/chinese/feed/')

  let emojiRegexp = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/

  let validArticles = feed.items.filter(item => {
    let categories = item.categories.filter(c => c.match(emojiRegexp))
    return categories.length > 0
  })

  return validArticles.map(item => {
    return {
      title: item.title,
      content: item['content:encoded'],
      link: item.link,
      pubDate: Date.parse(item.pubDate),
      site: '中国数字时代'
    }
  })
}

async function perform() {
  let sites = Object.keys(feedxUrls)

  sites.map(site => {
    performSite(site)
  })
  performSite('中国数字时代')
}

async function performSite(site) {
  try {
    let siteFolder = `./articles/${site}`
    fs.mkdirSync(siteFolder, { recursive: true })

    let files = fs.readdirSync(siteFolder)

    let lastId, lastDate
    if (files.length > 0) {
      let lastArticle = fs.readFileSync(`${siteFolder}/${files[0]}`, 'utf8')
      lastDate = +lastArticle.match(/<!--(\d+)-/)[1]
      lastId = +files[0].match(/(\d+)_/)[1]
    } else {
      lastId = 0xFFFFF
      lastDate = 0
    }

    let articles = await fetchArticles(site)

    articles.filter(x => x.pubDate > lastDate).map(a => {
      lastId -= 1
      generateArticle(a, lastId)
    })

    generateList(site)
  } catch(e) {
    console.log([site, e])
  }
}

function generateArticle(article, id) {
  let md = renderMD(article)

  let filename = `${id}_${article.title}.md`.replace(/\//g, '--')
  fs.writeFileSync(`./articles/${article.site}/${filename}`, md)
}

function generateList(site) {
  let siteFolder = `./articles/${site}`
  let files = fs.readdirSync(siteFolder).slice(0, 100)

  let listItems = files.map(item => {
    let title = item.match(/\d+_(.+)\.md/)[1]
    return `[${title}](/articles/${urlMod.resolve('', `${site}/${item}`)})\n`
  })
  let list = listItems.join("\n")
  let md = `${site}
------

${list}

[查看更多](/articles/${site})`
  fs.writeFileSync(`./lists/${site}.md`, md)
}

function strip(str) {
  return str.replace(/(^\s*|\s*$)/g, '')
}

function renderMD(item) {
  return `<!--${item.pubDate}-->
[${item.title}](${new URL(item.link).href})
------

${item.content.split("\n").map(line => strip(line)).join('')}
`
}

perform()
