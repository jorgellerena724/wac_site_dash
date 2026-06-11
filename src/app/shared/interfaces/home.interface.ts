export interface HomeData {
  id: number;
  title: string;
  description: string;
  version: number;
  photo: string;
  status: boolean;
  order?: number;
  star_rating?: number | null;
}
