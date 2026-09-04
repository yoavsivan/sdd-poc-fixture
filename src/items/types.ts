export interface Item {
  id: number;
  userId: number;
  url: string;
  title: string;
  note: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NewItem {
  url: string;
  title: string;
  note: string;
  tags: string[];
}

export interface ItemFilter {
  tag?: string;
  q?: string;
}

export interface ItemRow {
  id: number;
  user_id: number;
  url: string;
  title: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface ItemResponse {
  id: number;
  url: string;
  title: string;
  note: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemListResponse {
  items: ItemResponse[];
  count: number;
}

/**
 * Shape the UI and JSON API both send to clients.
 */
export function toItemResponse(item: Item): ItemResponse {
  return {
    id: item.id,
    url: item.url,
    title: item.title,
    note: item.note,
    tags: item.tags,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
