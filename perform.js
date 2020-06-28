let Parser = require('rss-parser')
let fs = require('fs')
let querystring = require('querystring')
let urlMod = require('url')
let URL = urlMod.URL

let feeds = [
  ['路透', 'https://feedx.net/rss/reuters.xml'],
  ['纽约时报', 'https://feedx.net/rss/nytimes.xml'],
  ['美国之音', 'https://feedx.net/rss/mgzy1.xml'],
  ['金融时报', 'https://feedx.net/rss/ft.xml'],
  ['BBC', 'https://feedx.net/rss/bbc.xml'],
  ['法广', 'https://feedx.net/rss/rfi.xml'],
  ['德国之声', 'https://feedx.net/rss/dw.xml']
]

async function fetchArticles() {
  let promises = feeds.map(async ([name, url]) => {
    let parser = new Parser()
    let feed = await parser.parseURL(url)

    return feed.items.map(item => {
      return {
        title: item.title,
        content: item.content,
        link: item.link,
        pubDate: Date.parse(item.pubDate),
        site: name
      }
    })
  })

  let values = await Promise.all(promises)

  let articles = values.reduce((a, x) => a.concat(x)).sort((x, y) => x.pubDate - y.pubDate)

  return articles
}

async function perform() {
  let last = JSON.parse(fs.readFileSync('./last', 'utf8'))
  lastId = last.id
  lastTime = last.time

  let fetchedArticles = await fetchArticles()

  fetchedArticles.filter(x => x.pubDate > lastTime).map(article => {
    lastId += 1
    lastTime = article.pubDate
    generateArticle(article, lastId)
  })

  fs.writeFileSync('./last', JSON.stringify({id: lastId, time: lastTime}))

  generateLists()

}

function generateLists() {
  let folders = fs.readdirSync('./articles')
  let sites = folders.map(folder => [folder, fs.readdirSync(`./articles/${folder}`)])
  sites.map(([site, articles]) => {
    generateList(site, articles)
  })
}

function generateArticle(article, id) {
  let md = renderMD(article)

  id = 0xFFFFF ^ id

  let filename = `${id}_${article.title}.md`.replace(/\//g, '--')
  fs.mkdirSync(`./articles/${article.site}`, { recursive: true })
  fs.writeFileSync(`./articles/${article.site}/${filename}`, md)
}

function generateList(site, articles) {
  let articleList = articles.slice(0, 100)

  let listItems = articleList.map(item => {
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
