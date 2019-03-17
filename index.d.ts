/**
Get the visual width of a string - the number of columns required to display it.

Some Unicode characters are [fullwidth](https://en.wikipedia.org/wiki/Halfwidth_and_fullwidth_forms) and use double the normal width. [ANSI escape codes](https://en.wikipedia.org/wiki/ANSI_escape_code) are stripped and doesn't affect the width.
*/
export default function stringWidth(text: string): number;
