import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const { method } = req;
  const { userId, action } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    if (method === 'GET') {
      // Busca consolidada usando aliases para manter camelCase no frontend
      const [transactions, categories, budgets, recurring] = await Promise.all([
        sql`SELECT id, user_id as "userId", date, description, amount, category_id as "categoryId", type, is_recurring as "isRecurring", recurring_id as "recurringId" FROM transactions WHERE user_id = ${userId} ORDER BY date DESC`,
        sql`SELECT id, user_id as "userId", name, color FROM categories WHERE user_id = ${userId}`,
        sql`SELECT category_id as "categoryId", amount FROM budgets WHERE user_id = ${userId}`,
        sql`SELECT id, user_id as "userId", description, amount, category_id as "categoryId", type, day_of_month as "dayOfMonth", active, start_date as "startDate", end_date as "endDate" FROM recurring_templates WHERE user_id = ${userId}`
      ]);

      return res.status(200).json({
        transactions: transactions.rows,
        categories: categories.rows,
        budgets: budgets.rows,
        recurring: recurring.rows
      });
    }

    if (method === 'POST') {
      const body = req.body;

      switch (action) {
        case 'addTransactions':
          // Processamento em lote para performance
          for (const t of body) {
            await sql`
              INSERT INTO transactions (id, user_id, date, description, amount, category_id, type, is_recurring, recurring_id)
              VALUES (${t.id}, ${userId}, ${t.date}, ${t.description}, ${t.amount}, ${t.categoryId}, ${t.type}, ${t.isRecurring || false}, ${t.recurringId || null})
              ON CONFLICT (id) DO UPDATE SET 
                date = ${t.date}, 
                description = ${t.description}, 
                amount = ${t.amount}, 
                category_id = ${t.categoryId}
            `;
          }
          break;

        case 'updateTransaction':
          await sql`
            UPDATE transactions 
            SET date = ${body.date}, description = ${body.description}, amount = ${body.amount}, category_id = ${body.categoryId}
            WHERE id = ${body.id} AND user_id = ${userId}
          `;
          break;

        case 'deleteTransaction':
          await sql`DELETE FROM transactions WHERE id = ${body.id} AND user_id = ${userId}`;
          break;

        case 'saveCategory':
          await sql`
            INSERT INTO categories (id, user_id, name, color)
            VALUES (${body.id}, ${userId}, ${body.name}, ${body.color})
            ON CONFLICT (id) DO UPDATE SET name = ${body.name}, color = ${body.color}
          `;
          break;

        case 'deleteCategory':
          await Promise.all([
            sql`DELETE FROM categories WHERE id = ${body.id} AND user_id = ${userId}`,
            sql`UPDATE transactions SET category_id = 'cat-unassigned' WHERE category_id = ${body.id} AND user_id = ${userId}`,
            sql`DELETE FROM budgets WHERE category_id = ${body.id} AND user_id = ${userId}`
          ]);
          break;

        case 'updateBudget':
          await sql`
            INSERT INTO budgets (user_id, category_id, amount)
            VALUES (${userId}, ${body.categoryId}, ${body.amount})
            ON CONFLICT (user_id, category_id) DO UPDATE SET amount = ${body.amount}
          `;
          break;

        case 'saveRecurring':
          await sql`
            INSERT INTO recurring_templates (id, user_id, description, amount, category_id, type, day_of_month, active, start_date, end_date)
            VALUES (${body.id}, ${userId}, ${body.description}, ${body.amount}, ${body.categoryId}, ${body.type}, ${body.dayOfMonth}, ${body.active}, ${body.startDate || null}, ${body.endDate || null})
            ON CONFLICT (id) DO UPDATE SET 
              description = ${body.description}, 
              amount = ${body.amount}, 
              active = ${body.active},
              category_id = ${body.categoryId},
              day_of_month = ${body.dayOfMonth}
          `;
          break;

        case 'deleteRecurring':
          await sql`DELETE FROM recurring_templates WHERE id = ${body.id} AND user_id = ${userId}`;
          break;

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database Error:', error);
    return res.status(500).json({ error: error.message });
  }
}