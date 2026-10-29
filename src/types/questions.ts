export type QuestionMode = "prefer" | "likely";

export type GameQuestion = {
  id: string;
  mode: QuestionMode;
  category: string;
  intensity: string;
  text: string;
};
