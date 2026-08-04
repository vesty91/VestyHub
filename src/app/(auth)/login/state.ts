export interface LoginState {
  status: "idle" | "error";
  message: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
}

export const initialLoginState: LoginState = {
  status: "idle",
  message: "",
};
