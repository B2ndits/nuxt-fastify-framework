import { z } from 'zod'

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空'),
  status: z.enum(['todo', 'doing', 'done']).optional(),
})
export type TaskInput = z.infer<typeof taskInputSchema>
