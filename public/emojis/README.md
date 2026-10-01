Waline emoji presets "bmoji" and "weibo", copied unchanged (info.json and PNG images) from
@waline/emojis 1.2.0 on npm (https://github.com/walinejs/emojis), so the comment box loads them
from this site instead of a CDN. The package is licensed under GPL-3.0-or-later (see LICENSE);
the emoji artwork belongs to its original owners, Bilibili and Weibo.

To add a preset, copy its folder from the same package here and add its name to
`integ.waline.emoji` in src/site.config.ts.
