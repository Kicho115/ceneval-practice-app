export type QuestionItem = {
  id: number
  prompt: string
  options: Record<string, string>
  sourcePages?: { question?: number }
  answer?: string
  /** Tema/sección en la guía (p. ej. "10. Desarrollo de Software de Aplicación - Lenguajes de Programación"). */
  category?: string
  /** Nombre del archivo PDF de origen. */
  sourcePdf?: string
}

export type ExamBank = {
  exam: string
  items: QuestionItem[]
}
