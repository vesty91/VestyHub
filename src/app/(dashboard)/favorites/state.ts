export interface FavoriteActionState {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export const initialFavoriteActionState: FavoriteActionState = {
  status: "idle",
  message: "",
};
