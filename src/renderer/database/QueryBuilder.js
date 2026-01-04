/**
 * QueryBuilder - Fluent interface for building safe parameterized SQL queries
 * Prevents SQL injection by always using placeholders
 */

export class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.type = 'SELECT';
    this.columns = ['*'];
    this.conditions = [];
    this.params = [];
    this.orderByClause = null;
    this.limitValue = null;
    this.offsetValue = null;
    this.insertData = null;
    this.updateData = null;
  }

  /**
   * Create a SELECT query builder
   * @param {string} table - Table name
   * @returns {QueryBuilder}
   */
  static select(table) {
    return new QueryBuilder(table).setType('SELECT');
  }

  /**
   * Create an INSERT query builder
   * @param {string} table - Table name
   * @returns {QueryBuilder}
   */
  static insert(table) {
    return new QueryBuilder(table).setType('INSERT');
  }

  /**
   * Create an UPDATE query builder
   * @param {string} table - Table name
   * @returns {QueryBuilder}
   */
  static update(table) {
    return new QueryBuilder(table).setType('UPDATE');
  }

  /**
   * Create a DELETE query builder
   * @param {string} table - Table name
   * @returns {QueryBuilder}
   */
  static delete(table) {
    return new QueryBuilder(table).setType('DELETE');
  }

  /**
   * Set query type
   * @param {string} type - Query type (SELECT, INSERT, UPDATE, DELETE)
   * @returns {QueryBuilder}
   */
  setType(type) {
    this.type = type;
    return this;
  }

  /**
   * Set columns to select
   * @param {string|string[]} columns - Column(s) to select
   * @returns {QueryBuilder}
   */
  select(columns) {
    if (Array.isArray(columns)) {
      this.columns = columns;
    } else {
      this.columns = [columns];
    }
    return this;
  }

  /**
   * Add a WHERE condition
   * @param {string} column - Column name
   * @param {string} operator - Comparison operator (=, !=, <, >, <=, >=, LIKE)
   * @param {*} value - Value to compare
   * @returns {QueryBuilder}
   */
  where(column, operator, value) {
    this.conditions.push({
      column,
      operator,
      connector: this.conditions.length > 0 ? 'AND' : ''
    });
    this.params.push(value);
    return this;
  }

  /**
   * Add an OR WHERE condition
   * @param {string} column - Column name
   * @param {string} operator - Comparison operator
   * @param {*} value - Value to compare
   * @returns {QueryBuilder}
   */
  orWhere(column, operator, value) {
    this.conditions.push({
      column,
      operator,
      connector: 'OR'
    });
    this.params.push(value);
    return this;
  }

  /**
   * Add a WHERE IN condition
   * @param {string} column - Column name
   * @param {Array} values - Values to match
   * @returns {QueryBuilder}
   */
  whereIn(column, values) {
    const placeholders = values.map(() => '?').join(', ');
    this.conditions.push({
      raw: `${column} IN (${placeholders})`,
      connector: this.conditions.length > 0 ? 'AND' : ''
    });
    this.params.push(...values);
    return this;
  }

  /**
   * Add a WHERE LIKE condition
   * @param {string} column - Column name
   * @param {string} pattern - LIKE pattern (with % wildcards)
   * @returns {QueryBuilder}
   */
  whereLike(column, pattern) {
    return this.where(column, 'LIKE', pattern);
  }

  /**
   * Add a WHERE column IS NULL condition
   * @param {string} column - Column name
   * @returns {QueryBuilder}
   */
  whereNull(column) {
    this.conditions.push({
      raw: `${column} IS NULL`,
      connector: this.conditions.length > 0 ? 'AND' : ''
    });
    return this;
  }

  /**
   * Add a WHERE column IS NOT NULL condition
   * @param {string} column - Column name
   * @returns {QueryBuilder}
   */
  whereNotNull(column) {
    this.conditions.push({
      raw: `${column} IS NOT NULL`,
      connector: this.conditions.length > 0 ? 'AND' : ''
    });
    return this;
  }

  /**
   * Set ORDER BY clause
   * @param {string} column - Column to order by
   * @param {string} direction - 'ASC' or 'DESC'
   * @returns {QueryBuilder}
   */
  orderBy(column, direction = 'ASC') {
    this.orderByClause = { column, direction: direction.toUpperCase() };
    return this;
  }

  /**
   * Set LIMIT
   * @param {number} limit - Maximum rows to return
   * @returns {QueryBuilder}
   */
  limit(limit) {
    this.limitValue = limit;
    return this;
  }

  /**
   * Set OFFSET
   * @param {number} offset - Rows to skip
   * @returns {QueryBuilder}
   */
  offset(offset) {
    this.offsetValue = offset;
    return this;
  }

  /**
   * Set data for INSERT
   * @param {Object} data - Key-value pairs to insert
   * @returns {QueryBuilder}
   */
  values(data) {
    this.insertData = data;
    return this;
  }

  /**
   * Set data for UPDATE
   * @param {Object} data - Key-value pairs to update
   * @returns {QueryBuilder}
   */
  set(data) {
    this.updateData = data;
    return this;
  }

  /**
   * Build the SQL query
   * @returns {{sql: string, params: Array}} SQL and parameters
   */
  build() {
    switch (this.type) {
      case 'SELECT':
        return this.buildSelect();
      case 'INSERT':
        return this.buildInsert();
      case 'UPDATE':
        return this.buildUpdate();
      case 'DELETE':
        return this.buildDelete();
      default:
        throw new Error(`Unknown query type: ${this.type}`);
    }
  }

  /**
   * Build SELECT query
   * @returns {{sql: string, params: Array}}
   */
  buildSelect() {
    const parts = [
      'SELECT',
      this.columns.join(', '),
      'FROM',
      this.table
    ];

    if (this.conditions.length > 0) {
      parts.push('WHERE');
      parts.push(this.buildConditions());
    }

    if (this.orderByClause) {
      parts.push('ORDER BY', this.orderByClause.column, this.orderByClause.direction);
    }

    if (this.limitValue !== null) {
      parts.push('LIMIT', String(this.limitValue));
    }

    if (this.offsetValue !== null) {
      parts.push('OFFSET', String(this.offsetValue));
    }

    return {
      sql: parts.join(' '),
      params: [...this.params]
    };
  }

  /**
   * Build INSERT query
   * @returns {{sql: string, params: Array}}
   */
  buildInsert() {
    if (!this.insertData) {
      throw new Error('No data provided for INSERT');
    }

    const columns = Object.keys(this.insertData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(this.insertData);

    return {
      sql: `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`,
      params: values
    };
  }

  /**
   * Build UPDATE query
   * @returns {{sql: string, params: Array}}
   */
  buildUpdate() {
    if (!this.updateData) {
      throw new Error('No data provided for UPDATE');
    }

    const setClauses = Object.keys(this.updateData).map(col => `${col} = ?`);
    const setValues = Object.values(this.updateData);

    const parts = [
      'UPDATE',
      this.table,
      'SET',
      setClauses.join(', ')
    ];

    if (this.conditions.length > 0) {
      parts.push('WHERE');
      parts.push(this.buildConditions());
    }

    return {
      sql: parts.join(' '),
      params: [...setValues, ...this.params]
    };
  }

  /**
   * Build DELETE query
   * @returns {{sql: string, params: Array}}
   */
  buildDelete() {
    const parts = [
      'DELETE FROM',
      this.table
    ];

    if (this.conditions.length > 0) {
      parts.push('WHERE');
      parts.push(this.buildConditions());
    }

    return {
      sql: parts.join(' '),
      params: [...this.params]
    };
  }

  /**
   * Build WHERE conditions string
   * @returns {string}
   */
  buildConditions() {
    return this.conditions.map((cond, index) => {
      const prefix = index === 0 ? '' : ` ${cond.connector} `;
      if (cond.raw) {
        return prefix + cond.raw;
      }
      return `${prefix}${cond.column} ${cond.operator} ?`;
    }).join('');
  }
}
