/**
 * SW Service Desk v1.0 - Camada de Acesso a Dados Relacional
 * Organização: SW Cloud Solutions
 * 
 * Suporta MySQL 8.0/MariaDB como fonte de verdade primária de produção via `mysql2/promise`.
 * Em ambiente de desenvolvimento local/sandbox sem daemon MySQL ativo, utiliza o motor
 * relacional SQL (sql.js) com persistência em disco em `./data/sw_servicedesk.sqlite`.
 * Garante que JSON ou localStorage NUNCA sejam utilizados como fonte de verdade.
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

export interface QueryResult {
  rows: any[];
  insertId?: number;
  affectedRows?: number;
}

class RelationalDatabase {
  private mysqlPool: mysql.Pool | null = null;
  private sqliteDb: SqlJsDatabase | null = null;
  private isSqliteFallback = false;
  private sqliteFilePath = path.resolve(process.cwd(), 'data', 'sw_servicedesk.sqlite');
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    // Criar diretório de dados se não existir
    const dataDir = path.dirname(this.sqliteFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER || 'sw_desk_user';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'sw_servicedesk';

    // Se dialect explicitamente sqlite ou se tentar ligar ao MySQL
    if (process.env.DB_DIALECT !== 'sqlite') {
      try {
        const pool = mysql.createPool({
          host,
          port,
          user,
          password,
          database,
          waitForConnections: true,
          connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
          queueLimit: 0,
          connectTimeout: 3000,
        });

        // Testar ligação
        const conn = await pool.getConnection();
        conn.release();
        this.mysqlPool = pool;
        this.isSqliteFallback = false;
        console.log(`[SW-DB] Ligação estabelecida com sucesso ao MySQL/MariaDB (${host}:${port}/${database}).`);
      } catch (err: any) {
        console.warn(`[SW-DB] Não foi possível ligar ao daemon MySQL (${err.message}). A ativar motor SQL relacional de contingência (SQLite persistente)...`);
        await this.initSqlite();
      }
    } else {
      await this.initSqlite();
    }

    this.isInitialized = true;
    await this.runMigrationsAndSeeds();
  }

  private async initSqlite() {
    this.isSqliteFallback = true;
    const SQL = await initSqlJs();

    if (fs.existsSync(this.sqliteFilePath)) {
      const buffer = fs.readFileSync(this.sqliteFilePath);
      this.sqliteDb = new SQL.Database(buffer);
      console.log(`[SW-DB] Base de dados relacional carregada de: ${this.sqliteFilePath}`);
    } else {
      this.sqliteDb = new SQL.Database();
      console.log(`[SW-DB] Nova base de dados relacional inicializada em: ${this.sqliteFilePath}`);
      this.saveSqlite();
    }
  }

  private saveSqlite() {
    if (this.sqliteDb && this.isSqliteFallback) {
      try {
        const data = this.sqliteDb.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.sqliteFilePath, buffer);
      } catch (err) {
        console.error('[SW-DB] Erro ao persistir ficheiro SQLite:', err);
      }
    }
  }

  private translateMySqlToSqlite(sql: string): string {
    return sql
      // Tipos de chave primária auto-increment
      .replace(/INT\s+(?:NOT\s+NULL\s+)?AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
      .replace(/INT\s+AUTOINCREMENT\s+PRIMARY\s+KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      // Motores e charsets MySQL
      .replace(/ENGINE\s*=\s*InnoDB/gi, '')
      .replace(/DEFAULT\s+CHARSET\s*=\s*utf8mb4/gi, '')
      .replace(/COLLATE\s*=\s*utf8mb4_unicode_ci/gi, '')
      .replace(/ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '')
      .replace(/LONGTEXT/gi, 'TEXT')
      .replace(/TIMESTAMP\s+DEFAULT\s+CURRENT_TIMESTAMP/gi, "DATETIME DEFAULT CURRENT_TIMESTAMP")
      .replace(/TIMESTAMP\s+NULL/gi, 'DATETIME NULL')
      .replace(/TIMESTAMP/gi, 'DATETIME')
      .replace(/BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+FALSE/gi, 'INTEGER NOT NULL DEFAULT 0')
      .replace(/BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+TRUE/gi, 'INTEGER NOT NULL DEFAULT 1')
      .replace(/BOOLEAN\s+DEFAULT\s+FALSE/gi, 'INTEGER DEFAULT 0')
      .replace(/BOOLEAN\s+DEFAULT\s+TRUE/gi, 'INTEGER DEFAULT 1')
      .replace(/BOOLEAN/gi, 'INTEGER')
      .replace(/ENUM\([^)]+\)/gi, 'TEXT')
      .replace(/JSON/gi, 'TEXT')
      // Remover índices inline do CREATE TABLE do MySQL (SQLite requer CREATE INDEX fora)
      .replace(/,\s*INDEX\s+[a-zA-Z0-9_]+\s*\([^)]+\)/gi, '')
      .replace(/UNIQUE\s+KEY\s+[a-zA-Z0-9_]+\s*\(([^)]+)\)/gi, 'UNIQUE ($1)')
      // Datas e funções
      .replace(/DATE_ADD\(NOW\(\),\s*INTERVAL\s+(\d+)\s+HOUR\)/gi, "datetime('now', '+$1 hours')")
      .replace(/NOW\(\)/gi, "datetime('now')")
      .replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE[\s\S]*?;/gi, ';');
  }

  private async runMigrationsAndSeeds() {
    try {
      // Verificar se a tabela de migrações existe
      const checkTableQuery = this.isSqliteFallback
        ? "SELECT name FROM sqlite_master WHERE type='table' AND name='users';"
        : "SHOW TABLES LIKE 'users';";

      const res = await this.query(checkTableQuery);
      if (res.rows.length === 0) {
        console.log('[SW-DB] A executar schema DDL inicial (001_initial_schema.sql)...');
        const schemaFile = path.resolve(process.cwd(), 'migrations', '001_initial_schema.sql');
        if (fs.existsSync(schemaFile)) {
          let schemaSql = fs.readFileSync(schemaFile, 'utf8');
          await this.executeMultiStatement(schemaSql);
        }

        console.log('[SW-DB] A executar seeds iniciais (001_initial_seeds.sql)...');
        const seedsFile = path.resolve(process.cwd(), 'seeds', '001_initial_seeds.sql');
        if (fs.existsSync(seedsFile)) {
          let seedsSql = fs.readFileSync(seedsFile, 'utf8');
          await this.executeMultiStatement(seedsSql);
        }
        console.log('[SW-DB] Migrações e seeds aplicadas com sucesso!');
      }
    } catch (err: any) {
      console.error('[SW-DB] Erro ao aplicar migrações/seeds:', err);
    }
  }

  private async executeMultiStatement(fullSql: string) {
    let sql = fullSql.replace(/--.*$/gm, '');
    if (this.isSqliteFallback) {
      sql = this.translateMySqlToSqlite(sql);
    }

    // Dividir comandos por ponto e vírgula
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await this.query(stmt);
      } catch (err: any) {
        // Se já existe ignorar, senão logar para diagnóstico
        if (!err.message?.includes('already exists') && !err.message?.includes('duplicate key')) {
          console.warn(`[SW-DB Exec Warning] ${err.message} in statement: ${stmt.slice(0, 80)}`);
        }
      }
    }

    if (this.isSqliteFallback) {
      this.saveSqlite();
    }
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isSqliteFallback && this.mysqlPool) {
      const [result] = await this.mysqlPool.query(sql, params);
      if (Array.isArray(result)) {
        return { rows: result };
      } else {
        const okPacket = result as mysql.ResultSetHeader;
        return {
          rows: [],
          insertId: okPacket.insertId,
          affectedRows: okPacket.affectedRows,
        };
      }
    } else if (this.sqliteDb) {
      let translatedSql = this.translateMySqlToSqlite(sql);

      // Normalizar datas e valores para o SQLite
      const normalizedParams = params.map((p) => {
        if (p === undefined) return null;
        if (typeof p === 'boolean') return p ? 1 : 0;
        if (typeof p === 'object' && p !== null && !(p instanceof Date)) {
          return JSON.stringify(p);
        }
        if (p instanceof Date) {
          return p.toISOString().slice(0, 19).replace('T', ' ');
        }
        return p;
      });

      const isSelect = /^\s*SELECT/i.test(translatedSql) || /^\s*PRAGMA/i.test(translatedSql) || /^\s*SHOW/i.test(translatedSql);

      try {
        if (isSelect) {
          const stmt = this.sqliteDb.prepare(translatedSql);
          if (normalizedParams.length > 0) {
            stmt.bind(normalizedParams);
          }
          const rows: any[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return { rows };
        } else {
          this.sqliteDb.run(translatedSql, normalizedParams);
          const lastIdRes = this.sqliteDb.exec('SELECT last_insert_rowid() as id, changes() as affected;');
          let insertId = 0;
          let affectedRows = 0;
          if (lastIdRes.length > 0 && lastIdRes[0].values.length > 0) {
            insertId = Number(lastIdRes[0].values[0][0]) || 0;
            affectedRows = Number(lastIdRes[0].values[0][1]) || 0;
          }
          this.saveSqlite();
          return { rows: [], insertId, affectedRows };
        }
      } catch (err: any) {
        throw new Error(`[SW-SQL Error] ${err.message} in query: ${translatedSql.slice(0, 100)}`);
      }
    }

    throw new Error('[SW-DB] Nenhum motor de base de dados relacional está disponível.');
  }

  isUsingSqliteFallback(): boolean {
    return this.isSqliteFallback;
  }
}

export const db = new RelationalDatabase();
