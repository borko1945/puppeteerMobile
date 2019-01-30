const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    // args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=2', { waitUntil: 'networkidle2' });

  var paginationUrls = await performSearchAndReturnResultPageUrls(page);
  let adsUrlList = [];
  for (var pageUrl of paginationUrls) {
    var addUrls = await returnPageCarAdds(page, pageUrl);
    adsUrlList = adsUrlList.concat(addUrls);
  }

  for (let adUrl of adsUrlList) {
    await parseAd(page, adUrl);
  }

  // await page.pdf({ path: 'page.pdf', format: 'A4' });
  await browser.close();
})();

async function returnPageCarAdds(page, pageUrl) {
  console.log(pageUrl);
  await page.goto(pageUrl, { waitUntil: 'networkidle2' });
  const data = await page.evaluate(() => {
    const linkImages = Array.from(document.querySelectorAll('td.algcent.valgmid a.photoLink'));
    return linkImages.map(td => td.href);
  });

  return data;
}

async function performSearchAndReturnResultPageUrls(page) {
  await page.select('#mainholder > form > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(3) > td:nth-child(1) > select', 'Ford');
  await page.select('#mainholder > form > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(5) > td:nth-child(1) > select', 'Kia');
  await page.select('#mainholder > form > table > tbody > tr > td > table:nth-child(3) > tbody > tr:nth-child(3) > td:nth-child(1) > select', 'Toyota');
  // Select - year
  await page.select('#mainholder > form > table > tbody > tr > td > table:nth-child(3) > tbody > tr:nth-child(3) > td:nth-child(5) > select', '2007');
  // Select - past 2 days
  await page.select('#mainholder > form > table > tbody > tr > td > table:nth-child(3) > tbody > tr:nth-child(3) > td:nth-child(9) > select', '7');

  // Exclude new imports
  await page.click('#eimg95');
  await page.click('#eimg95');

  // Select - milage 110000
  await page.select('#mainholder > form > table > tbody > tr > td > table:nth-child(5) > tbody > tr:nth-child(3) > td:nth-child(5) > select', '110000');

  // Select - only private adds. Problem with selector so uzing xPath
  const xpath = '//*[@id="mainholder"]/form/table/tbody/tr/td/table[7]/tbody/tr[2]/td[4]/label[3]/input';
  await page.evaluate(
    (xpath) => {
      document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue.click();
    },
    xpath
  );

  // Select - enter price 
  await page.type('#mainholder > form > table > tbody > tr > td > table:nth-child(4) > tbody > tr:nth-child(3) > td:nth-child(4) > input', '60000');

  await page.pdf({ path: 'page.pdf', format: 'A4' });
  // Click on search button
  await page.click('#mainholder > form > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(1) > td:nth-child(7) > input[type="button"]');
  await page.waitForNavigation();

  const pages = await page.evaluate(() => {
    let pagesCount = Array.from(document.querySelectorAll('.pageNumbers')).length;
    if (pagesCount == 0) {
      pagesCount = 1;
    }

    return pagesCount;
  });

  return generatePageUrls(page.url(), pages);
}

async function generatePageUrls(url, pageCount) {
  const baseUrl = url.substr(0, url.length - 1);
  var pageUrls = [];
  for (var i = 1; i <= pageCount; i++) {
    pageUrls.push(baseUrl + i);
  }
  return pageUrls;
}

async function parseAd(page, url) {
  console.log('Parsing: ', url);
  await page.goto(url, { waitUntil: 'networkidle2' });

  let car = await page.evaluate(() => {
    let car = {};
    car.name = document.querySelector('form h1').textContent;
    car.price = document.querySelector('#mainholder > table:nth-child(4) > tbody > tr > td:nth-child(1) > form:nth-child(3) > table:nth-child(123) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(1) > td:nth-child(2) > span').textContent;
    car.fuel = document.querySelector('#mainholder > table:nth-child(4) > tbody > tr > td:nth-child(1) > form:nth-child(3) > table:nth-child(123) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(4) > td:nth-child(2) > b').textContent;
    car.milage = document.querySelector('#mainholder > table:nth-child(4) > tbody > tr > td:nth-child(1) > form:nth-child(3) > table:nth-child(123) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(9) > td:nth-child(2) > b').textContent;
    car.year = document.querySelector('#mainholder > table:nth-child(4) > tbody > tr > td:nth-child(1) > form:nth-child(3) > table:nth-child(123) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(3) > td:nth-child(2) > b').textContent;
    car.hp = document.querySelector('#mainholder > table:nth-child(4) > tbody > tr > td:nth-child(1) > form:nth-child(3) > table:nth-child(123) > tbody > tr:nth-child(1) > td:nth-child(3) > table > tbody > tr:nth-child(5) > td:nth-child(2) > b').textContent;
    // car.description = document.querySelector('#mainholder > table:nth-child(4) > tbody > tr > td:nth-child(1) > form:nth-child(3) > table:nth-child(128) > tbody > tr > td').textContent;
    
    var xpath = "//div[text()='Допълнителна информация:']";
    var matchingElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (matchingElement == null) {
      car.description = "";
    } else {
      car.description = matchingElement.nextElementSibling.innerText.trim();
    }
    
    return car;
  });
  car.url = url;
  console.log(car);
}

// class CarAd {
//   url;
//   name;
//   price;
//   fuel;
//   milage;
//   year;
//   hp;
//   description;
//   location;
// };