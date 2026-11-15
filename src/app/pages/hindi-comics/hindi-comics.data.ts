export interface ComicPart {
  id: string;
  title: string;
  isNew?: boolean;
}

export interface ComicSeries {
  id: string;
  title: string;
  isNew?: boolean;
  parts: ComicPart[];
}

export const HINDI_COMICS: ComicSeries[] = [
  {
    id: 'changing-room',
    title: 'Changing Room',
    isNew: true,
    parts: [
      { id: 'part-1', title: 'Part 1', isNew: true },
      { id: 'part-2', title: 'Part 2', isNew: true }
    ]
  }
];

export function getFirstNewComicTarget(): { comic: string; part: string } | null {
  for (const comic of HINDI_COMICS) {
    const newPart = comic.parts.find(part => part.isNew);
    const targetPart = newPart ?? (comic.isNew ? comic.parts[0] : undefined);
    if (targetPart && (comic.isNew || targetPart.isNew)) {
      return { comic: comic.id, part: targetPart.id };
    }
  }

  return null;
}

export function hasNewComicContent(): boolean {
  return HINDI_COMICS.some(comic =>
    comic.isNew || comic.parts.some(part => part.isNew)
  );
}
