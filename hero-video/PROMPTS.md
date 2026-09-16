# Beeviro — should there be a generated film, and what to prompt

> Rewritten after the supervisor review. The previous version of this file
> planned a 6 MB autoplaying hero film. **Do not build that.** Both reviewers
> named video weight as the reason the site felt heavy:
>
> * *"the biggest issue is that the site is way too heavy because of the video
>   files, causing lag and frame drops"*
> * *"if you have a downloader like Neat Download Manager or IDM it will detect
>   videos and ask if you want to download"*
>
> The site already carries six real client reels in the hero comb. Adding a
> seventh video that plays whether or not anybody asked for it moves in exactly
> the direction the review told us to move away from.

---

## The recommendation, plainly

**The home page does not need another video, and I would not add one there.**

What it does lack is a **voice** — 25 case files and no single place where
Beeviro says what it is. That is worth one film. The way to add it without
undoing the last two days of work is:

* **poster-first, click-to-play.** Zero bytes until a reader presses play. A
  still frame is ~25 KB; the film only downloads for someone who chose it.
* **in the Voices section**, where the brand line already sits, not the hero.
* **silent, with burned-in or `.vtt` captions in both languages** — nobody
  should have to hear it, and an Arabic reader should not get an English-only
  asset on a site that now reads in Arabic throughout.
* **fetched as a blob**, the same trick the hero reels use, so the download
  managers stay quiet.

Say the word and I will wire the player — it is a poster, a play control, and
about thirty lines. It needs the file first.

### Hard budget — this is the part that matters

| | |
|---|---|
| length | **15–25 s.** Past 25 s nobody finishes it and every second costs bytes. |
| resolution | **1280×720.** It plays in a ~760 px box. 1080p is 2× the bytes for nothing. |
| file | **≤ 1.2 MB.** Non-negotiable; that is roughly the whole rest of the page. |
| audio | **none.** Strip the track entirely — it is dead weight in a silent player. |
| format | **WebM (VP9)** primary. |
| poster | one frame, exported as a still. I will convert it. |

If Flow only gives you a big MP4, hand me the raw export and I will re-encode it
with `tools/shrink-reels.mjs` — that is exactly what it does, and it is how the
six hero reels went from 1.96 MB to 0.55 MB.

---

## Prompt A — the brand film (use this one)

Veo cannot montage Beeviro's actual client work, and it should not try: that
work is already all over the page in its real form. So this film is **material
and atmosphere** — the honeycomb as a made object — and the words are added
afterwards in HTML, where they stay editable, translatable and searchable.

Set Flow to **16:9**, **720p or 1080p**, longest duration available. Standard
text-to-video (this one is not a loop, so no frames-to-video trick needed).

```
Slow cinematic macro film of a dark honeycomb structure, shot like a premium
product film. Warm golden amber light glows from deep inside the hexagonal
cells and moves slowly through the comb, cell to cell, as if something is being
built inside it. Thick honey catches the light on one wax edge. The camera makes
one very slow push-in and one slow lateral drift, nothing faster. Deep matte
black background, amber as the only colour, volumetric haze, shallow depth of
field with soft bokeh in the far cells, fine wax surface texture. Locked-off
tripod feel, no handheld shake, no whip pans, no cuts. Patient, quiet, expensive.

Negative: no text, no words, no letters, no numbers, no logos, no watermarks,
no people, no hands, no faces, no bees, no insects, no flowers, no fast motion,
no camera shake, no lens flares, no colour other than amber and black, no
cartoon or 3D-render look.
```

**Why the negatives are that long.** Veo will put a bee in it if you let it, and
Beeviro's mark is a bee — a generated one next to the real logo reads as a
mistake, not a motif. It will also try to write words, and generated lettering is
always slightly wrong. Every line of copy on this site is real HTML in two
languages; none of it should be baked into a video.

## Prompt B — if A comes out too static

```
Slow cinematic macro film of amber light travelling through a dark hexagonal
lattice. The light enters at one edge and moves cell to cell in a slow wave,
each hexagon filling with warm glow and fading as the wave passes, so the whole
comb reads as a system carrying something forward. Deep matte black, single amber
accent, volumetric haze, shallow depth of field. Extremely slow camera drift,
almost still. Locked-off, no cuts.

Negative: no text, no words, no logos, no people, no bees, no insects, no fast
motion, no camera shake, no additional colours, no cartoon or 3D-render look.
```

---

## What to upload as reference

| File | Use it as |
|---|---|
| `references/01-REF-first-and-last-frame-16x9.png` (2752×1536) | **Style / ingredient reference.** This is the exact photograph the site's hero uses, so the film will sit in the same world as the page it lives on. |
| `../site/assets/work/kinetic-health/01.jpg` | Second style reference — dark, clinical, premium, warm-lit. Real client work. |
| `../site/assets/work/master-craft/03.jpg` | Third — dark luxury, amber highlights on black. Real client work. |

**Do NOT upload `references/03-brand-mark-DO-NOT-render.png`.** It is there so
*you* can eyeball the amber (`#FFC202`) against what Flow gives back. Feed the
logo to Veo and it will try to draw it, and it will come out wrong. The mark is
already on the page as real artwork.

`references/02-REF-vertical-9x16.png` is only for a separate 9:16 cut, which
this use does not need — the player is a landscape box in a landscape section.

### Judging the takes

Generate three or four and pick on these, in order:

1. **Is it dark enough?** It sits on `#0a0909`. A grey film looks like a hole in
   the page.
2. **Is the amber the brand amber?** Compare against the mark. Orange is wrong.
3. **Does it hold still?** The whole page moves already. A film that also moves
   fights everything around it.
4. **Does the last second sit near the first?** Not required — the player is not
   a loop — but a film that ends where it began can be looped later for free.

---

## When you have it

Drop the export at `hero-video/brand-film-raw.<ext>` and the poster frame at
`hero-video/brand-film-poster.<ext>` and tell me. I will re-encode to budget,
generate the poster at the right size, wire the click-to-play player into the
Voices section with the blob fetch, and add the Arabic and English caption
tracks. Nothing ships until the file is under 1.2 MB.
