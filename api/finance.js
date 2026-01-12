
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function ensureSchema(client) {
  // Executar comandos individualmente é mais seguro em drivers PG
  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      category_id TEXT NOT NULL,
      type TEXT NOT NULL,
      is_recurring BOOLEAN DEFAULT FALSE,
      recurring_id TEXT
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      PRIMARY KEY (user_id, category_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS recurring_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      category_id TEXT NOT NULL,
      type TEXT NOT NULL,
      day_of_month INTEGER NOT NULL,
      active BOOLEAN DEFAULT TRUE,
      start_date DATE,
      end_date DATE
    )
  `);
}

export default async function handler(req, res) {
  const { method } = req;
  const { userId, action } = req.query;

  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ 
      error: 'Variável de ambiente de banco de dados ausente.',
      details: 'Certifique-se de que POSTGRES_URL ou DATABASE_URL está configurada no painel da Vercel.'
    });
  }

  if (!userId) {
    return res.status(400).json({ error: 'User ID é obrigatório.' });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Inicialização do esquema
    try {
      await ensureSchema(client);
    } catch (schemaError) {
      console.error('Schema creation failed:', schemaError);
      return res.status(500).json({ 
        error: 'Falha ao preparar as tabelas do banco de dados.', 
        details: schemaError.message 
      });
    }

    if (method === 'GET') {
      const [transactions, categories, budgets, recurring] = await Promise.all([
        client.query('SELECT id, user_id as "userId", date, description, amount::float, category_id as "categoryId", type, is_recurring as "isRecurring", recurring_id as "recurringId" FROM transactions WHERE user_id = $1 ORDER BY date DESC', [userId]),
        client.query('SELECT id, user_id as "userId", name, color FROM categories WHERE user_id = $1', [userId]),
        client.query('SELECT category_id as "categoryId", amount::float FROM budgets WHERE user_id = $1', [userId]),
        client.query('SELECT id, user_id as "userId", description, amount::float, category_id as "categoryId", type, day_of_month as "dayOfMonth", active, start_date as "startDate", end_date as "endDate" FROM recurring_templates WHERE user_id = $1', [userId])
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
          for (const t of body) {
            await client.query(`
              INSERT INTO transactions (id, user_id, date, description, amount, category_id, type, is_recurring, recurring_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (id) DO UPDATE SET 
                date = EXCLUDED.date, 
                description = EXCLUDED.description, 
                amount = EXCLUDED.amount, 
                category_id = EXCLUDED.category_id
            `, [t.id, userId, t.date, t.description, t.amount, t.categoryId, t.type, t.isRecurring || false, t.recurringId || null]);
          }
          break;

        case 'updateTransaction':
          await client.query(`
            UPDATE transactions 
            SET date = $1, description = $2, amount = $3, category_id = $4
            WHERE id = $5 AND user_id = $6
          `, [body.date, body.description, body.amount, body.categoryId, body.id, userId]);
          break;

        case 'deleteTransaction':
          await client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [body.id, userId]);
          break;

        case 'saveCategory':
          await client.query(`
            INSERT INTO categories (id, user_id, name, color)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color
          `, [body.id, userId, body.name, body.color]);
          break;

        case 'deleteCategory':
          await client.query('BEGIN');
          try {
            await client.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [body.id, userId]);
            await client.query("UPDATE transactions SET category_id = 'cat-unassigned' WHERE category_id = $1 AND user_id = $2", [body.id, userId]);
            await client.query('DELETE FROM budgets WHERE category_id = $1 AND user_id = $2', [body.id, userId]);
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK');
            throw e;
          }
          break;

        case 'updateBudget':
          await client.query(`
            INSERT INTO budgets (user_id, category_id, amount)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, category_id) DO UPDATE SET amount = EXCLUDED.amount
          `, [userId, body.categoryId, body.amount]);
          break;

        case 'saveRecurring':
          await client.query(`
            INSERT INTO recurring_templates (id, user_id, description, amount, category_id, type, day_of_month, active, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET 
              description = EXCLUDED.description, 
              amount = EXCLUDED.amount, 
              active = EXCLUDED.active,
              category_id = EXCLUDED.category_id,
              day_of_month = EXCLUDED.day_of_month,
              start_date = EXCLUDED.start_date,
              end_date = EXCLUDED.end_date
          `, [body.id, userId, body.description, body.amount, body.categoryId, body.type, body.dayOfMonth, body.active, body.startDate || null, body.endDate || null]);
          break;

        case 'deleteRecurring':
          await client.query('DELETE FROM recurring_templates WHERE id = $1 AND user_id = $2', [body.id, userId]);
          break;

        default:
          return res.status(400).json({ error: 'Ação inválida' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (error) {
    console.error('API ERROR:', error);
    return res.status(500).json({ 
      error: 'Erro na operação do banco de dados', 
      details: error.message,
      pgCode: error.code
    });
  } finally {
    if (client) client.release();
  }
}
