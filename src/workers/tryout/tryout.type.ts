import { TryoutTypeEnum } from "src/api/tryout-cms/tryout-cms.enum"
import { Options } from "src/database/schema"

export type QuestionType = {
  id: string,
  tryoutSetId: string,
  isTextAnswer: boolean,
  correctScoreWeight: number,
  wrongScoreWeight: number,
  correctAnswersCount: number,
  type: TryoutTypeEnum
  options: Options[],
  correctAnswers: string[], // for table and fill-in question
}

export type QuestionAttemptType = {
  id: string,
  userId: string,
  tryoutSetId: string,
  questionId: string,
  isCorrect: boolean,
  score: number, 
}