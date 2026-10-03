---
layout: '@/layouts/IndividualPage.astro'

title: 'Privacy Policy'
description: 'Last updated: 2026-10-03'
language: 'en'
back: '/terms'
---

This is a static site. The pages themselves contain no server-side code, and the site does not actively collect information about visitors, except in the cases described below.

## Server logs

The site is hosted on Alibaba Cloud ECS and delivered through Cloudflare's proxy. As is standard practice, the web server keeps access logs containing your IP address, the time of access, the request path, and your User Agent, which are used for troubleshooting and security auditing.

Because traffic is relayed through Cloudflare, Cloudflare processes your IP address and request information. Its data processing is subject to the [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).

## Comments

This site uses [Waline](https://waline.js.org) for comments. When you post a comment, the following is recorded:

- Your nickname, email address, and website (as entered by you)
- Your IP address and User Agent
- The content of the comment and the page it was posted on

Your email address is used to notify you when someone replies, and it is also hashed to fetch your Gravatar avatar. The view counts shown on post pages are also recorded by Waline; only the page path and the count are stored, and they are not linked to any individual.

The comment box saves the nickname, email address and website you entered, along with emoji and like states, in your browser's local storage for next time. Clearing this site's data removes them.

## Visitor analytics

This site uses a self-hosted instance of [Counterscale](https://github.com/benvinegar/counterscale), deployed on Cloudflare Workers, to collect visit statistics. It records:

- The site domain and page path
- The referring page (referrer)
- Country/region
- Browser name and version, device type and model, and User Agent
- `utm_*` parameters in the URL (if any)
- Whether you are a new visitor, whether it is a new session, and whether the visit is a bounce

Counterscale does not use cookies and does not write anything to your browser's storage.

The data is stored in Cloudflare Analytics Engine and is **automatically deleted after 90 days**.

The analytics dashboard is public, and anyone can view it: <https://stats.residream.com>

## Appearance preference

The appearance you choose (match system, light, or dark) is saved in your browser's local storage and in a cookie named `residream-theme`. This cookie applies to residream.com and its subdomains, so that the blog, visitor analytics, website status, and online tools all display the same appearance. Your browser sends it along with requests to these sites, but it only records your appearance choice and contains no identifying information.

## Third-party resources

Pages load resources from the following third parties, which may therefore learn your IP address and User Agent:

- The Hitokoto quote API, used for the random sentence at the bottom of the Chinese home page
- The DummyJSON quote API, used for the random sentence at the bottom of the English home page
- GitHub's avatar service (avatars.githubusercontent.com), used for the avatars on GitHub project cards in posts
- The ghchart service (ghchart.rshah.org), used for the GitHub contribution chart on the Projects page
- Giphy, used for GIF searches in the comment box and to load images from that service in comments

These services process data in accordance with their own privacy policies. The public numbers on the About page (from GitHub, Bilibili, Steam and others) are fetched periodically by this site's server. Displaying these numbers does not require your browser to contact those platforms directly.

## Contact

If you would like to access, correct, or delete any data you have left on this site, you can contact me at <me@residream.dev>.
