import type { FontProvider } from 'astro'

// Fixed variants from Fontshare; Astro downloads and serves these from this site.
// https://www.fontshare.com/fonts/satoshi
export default {
  name: 'satoshi-fontshare',
  resolveFont: () => ({
    fonts: [
      {
        weight: 400,
        display: 'swap',
        style: 'normal',
        src: [
          {
            url: 'https://cdn.fontshare.com/wf/TTX2Z3BF3P6Y5BQT3IV2VNOK6FL22KUT/7QYRJOI3JIMYHGY6CH7SOIFRQLZOLNJ6/KFIAZD4RUMEZIYV6FQ3T3GP5PDBDB6JY.woff2',
            format: 'woff2'
          }
        ]
      },
      {
        weight: 400,
        display: 'swap',
        style: 'italic',
        src: [
          {
            url: 'https://cdn.fontshare.com/wf/MPIFA4B3XXRNY2MJDGP6GOOOAF6EOCLO/W5E4ZFYPJ3V6JKMBGHB6YMITK6EWS2XA/QOMBWPST76ICDYF6WOBS7SQ7RBT67QW2.woff2',
            format: 'woff2'
          }
        ]
      },
      {
        weight: 500,
        display: 'swap',
        style: 'normal',
        src: [
          {
            url: 'https://cdn.fontshare.com/wf/P2LQKHE6KA6ZP4AAGN72KDWMHH6ZH3TA/ZC32TK2P7FPS5GFTL46EU6KQJA24ZYDB/7AHDUZ4A7LFLVFUIFSARGIWCRQJHISQP.woff2',
            format: 'woff2'
          }
        ]
      },
      {
        weight: 500,
        display: 'swap',
        style: 'italic',
        src: [
          {
            url: 'https://cdn.fontshare.com/wf/NID3I7RITWZSKXRCJGOCMP5NOADJK6IG/2HLHGD7OBTWCOHW64YXOE5KFXHU4KJHM/ZHME2QIRFR7UPJ47NLY27RCAFY44CKZJ.woff2',
            format: 'woff2'
          }
        ]
      }
    ]
  })
} satisfies FontProvider
