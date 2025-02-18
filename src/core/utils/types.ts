export type NonNullableArray<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

export type ExtractedPages = NonNullableArray<ExtractedContent['pages']>; 