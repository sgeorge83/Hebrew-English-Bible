# Hebrew English Bible

Kindle-style bilingual Bible reader: **Hebrew OT** (Westminster Leningrad Codex) and **Greek NT** (Nestle 1904) with Roman transliteration, paired verse-by-verse with the **World English Bible**.

## Features

- Original language → Roman → English per verse
- Tap key words to learn gloss, Strong's number, and play verse audio
- Stream verse audio (CC BY 4.0) with optional per-book offline download
- Day / sepia / night themes, horizontal pagination, highlights & notebook
- 814-day Book of Common Prayer reading plan
- Offline text download (~8 MB)

## Data sources

| Layer | Repository |
|-------|------------|
| Hebrew OT + Greek NT | [original-language-bible-data](https://github.com/sgeorge83/original-language-bible-data) |
| English WEB | [english-bible-data](https://github.com/sgeorge83/english-bible-data) |
| Verse audio | [MP3_OpenHebrewGreekBible_fast](https://github.com/eliranwong/MP3_OpenHebrewGreekBible_fast) (CC BY 4.0) |

## Run locally

```bash
npx serve .
# or: python -m http.server 8080
```

Open `http://localhost:8080` (or the port shown).

## Deploy

Push to `main` — GitHub Actions deploys to GitHub Pages automatically.

## License

App code: project of WordOnAir Labs. Bible texts and audio carry their own licenses (see Versions panel in the app).
