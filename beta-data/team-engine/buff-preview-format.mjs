// Keep numeric rule values intact; only round their displayed percentages.
export const percent=value=>`${Number((value*100).toFixed(4))}%`;
