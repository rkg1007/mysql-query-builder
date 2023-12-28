// Class for constructing SQL code for database queries.
export default class WhereClauseGenerator {
  /**
   * Constructor to initialize the class instance.
   */
  constructor() {
    this.whereClauses = []; // Array to store individual WHERE conditions
    this.whereClauseValues = []; // Array to store values for the conditions
  }

  #validateOperator(operator) {
    const supportedOperators = [
      '=',
      '!=',
      '<>',
      'LIKE',
      'NOT LIKE',
      'BETWEEN',
      'NOT BETWEEN',
      'IS',
      'IS NOT',
      'IN',
      'NOT IN',
      '>',
      '>=',
      '<',
      '<=',
      '<=>',
      'IS NULL',
      'IS NOT NULL',
    ];
    if (!supportedOperators.includes(operator)) {
      return `The operator "${operator}" is not supported in this context.`;
    }
    return null;
  }

  #validateValue(value) {
    if (value === undefined) {
      return 'The value in the WHERE condition cannot be undefined.';
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value._value !== undefined && value._operator === undefined) {
        throw new Error(
          `When using a custom operator in a WHERE condition object, you must provide both '_value' and '_operator' properties.`
        );
      }
      if (value._value === undefined && value._operator !== undefined) {
        throw new Error(
          `When using a custom operator in a WHERE condition object, you must provide both '_value' and '_operator' properties.`
        );
      }
    }

    return null;
  }

  #buildBasicComparisonCondition(column, operator, value) {
    return [[`'${column}' ${operator} ?`], [value]];
  }

  #buildInCondition(column, operator, values) {
    if (!Array.isArray(values)) {
      throw new Error(
        `The IN and NOT IN operators expect an array of values, but a ${typeof values} was provided.`
      );
    }
    if (values.length === 0) {
      throw new Error(
        `The IN and NOT IN operators require at least one value in the provided array, but an empty array was given.`
      );
    }

    for (let i = 0; i < values.length; i++) {
      if (typeof values[i] !== 'string' && typeof values[i] !== 'number') {
        throw new Error(
          `Invalid value type at index ${i} in the array used with the IN or NOT IN operator. Only strings or numbers are allowed, but a value of type ${typeof values[
            i
          ]} was found.`
        );
      }
    }

    return [
      [`'${column}' ${operator} (${values.map(() => '?').join(', ')})`],
      values,
    ];
  }

  #buildBetweenCondition(column, operator, values) {
    if (!Array.isArray(values)) {
      throw new Error(
        `The BETWEEN and NOT BETWEEN operators expect an array of values, but a ${typeof values} was provided.`
      );
    }
    if (values.length !== 2) {
      throw new Error(
        `The BETWEEN and NOT BETWEEN operators require exactly two values to define a range, but the provided array has ${values.length} values.`
      );
    }

    return [[`'${column}' ${operator} ? AND ?`], values];
  }

  #buildNullCheckCondition(column, operator) {
    return [[`'${column}' ${operator}`], []];
  }

  #buildTruthCheckCondition(column, operator, value) {
    if (typeof value != 'boolean') {
      throw new Error(
        `The IS and IS NOT operators expect a boolean, but a ${typeof value} was provided.`
      );
    }
    return [[`'${column}' ${operator} ?`], [value ? 'TRUE' : 'FALSE']];
  }

  /**
   * Builds a single WHERE condition string and returns associated values.
   *
   * @param {string} column - The column name for the condition.
   * @param {any} value - The value to compare against.
   * @param {string} operator - The comparison operator (defaults to '=').
   * @returns {[string, any[]]} - Returns an array with the condition string and values.
   */
  #buildWhereClause(column, values, operator = '=') {
    const validationError = this.#validateOperator(operator);
    if (validationError) {
      throw new Error(validationError);
    }

    if (['IN', 'NOT IN'].includes(operator)) {
      return this.#buildInCondition(column, operator, values);
    } else if (['BETWEEN', 'NOT BETWEEN'].includes(operator)) {
      return this.#buildBetweenCondition(column, operator, values);
    } else if (['IS NULL', 'IS NOT NULL'].includes(operator)) {
      return this.#buildNullCheckCondition(column, operator);
    } else if (['IS', 'IS NOT'].includes(operator)) {
      return this.#buildTruthCheckCondition(column, operator, values);
    }
    return this.#buildBasicComparisonCondition(column, operator, values);
  }

  #buildWherClauseForNull(columnName) {
    return this.#buildWhereClause(columnName, null, 'IS NULL');
  }

  #buildWherClauseForArray(columnName, values) {
    return this.#buildWhereClause(columnName, values, 'IN');
  }

  #buildWherClauseWithOperator(columnName, operator, value) {
    return this.#buildWhereClause(columnName, value, operator);
  }

  #buildWherClauseForNestedObject(columnName, nestedConditions) {
    return this.#buildWhereClause(nestedConditions, columnName);
  }

  #buildWherClauseForDefaultComparison(columnName, value) {
    return this.#buildWhereClause(columnName, value, '=');
  }

  /**
   * Builds a WHERE condition string and its associated value based on the given value type.
   *
   * @param {string} columnName - The name of the column to which the condition applies.
   * @param {any} columnValue - The value to be used in the condition.
   * @returns {[string[], any[]]} - An array containing two elements:
   *   1. The generated WHERE condition string.
   *   2. The value to be used with the condition.
   * @throws {Error} If the value is invalid.
   */
  #generateWherClauseForValue(columnName, columnValue) {
    // Validate the value before proceeding:
    const validationError = this.#validateValue(columnValue);
    if (validationError) {
      throw new Error(validationError);
    }

    // Handle different value types:
    if (columnValue === null) {
      // Build a condition for a NULL value:
      return this.#buildWherClauseForNull(columnName);
    } else if (Array.isArray(columnValue)) {
      // Build a condition for an array of values (likely for IN or NOT IN operators):
      return this.#buildWherClauseForArray(columnName, columnValue);
    } else if (typeof columnValue === 'object') {
      // Handle nested objects with custom operator:
      if (columnValue._operator !== undefined) {
        // Build a condition with a custom operator specified within the object:
        return this.#buildWherClauseWithOperator(
          columnName,
          columnValue._operator,
          columnValue._value
        );
      } else {
        // Build a condition for a nested object, likely representing complex conditions:
        return this.#buildWherClauseForNestedObject(columnName, columnValue);
      }
    }
    // Build a default comparison condition for scalar values:
    return this.#buildWherClauseForDefaultComparison(columnName, columnValue);
  }

  /**
   * Builds an array of WHERE conditions and their associated values for a query.
   *
   * @param {object} conditions - An object containing the conditions to build.
   * @param {string} [prefix] - An optional prefix to prepend to column names.
   * @returns {[string[], any[]]} - An array containing two arrays:
   *   1. An array of WHERE condition strings.
   *   2. An array of values to be used with those conditions.
   */
  #buildWhereClauses(conditions, prefix = null) {
    // Initialize arrays to store the conditions and values:
    let whereClauses = [];
    let whereClauseValues = [];

    // Iterate through each key-value pair in the conditions object:
    Object.keys(conditions).forEach((key) => {
      // Construct the column name with optional prefix:
      const columnName = prefix ? `${prefix}.${key}` : key;
      const columnValue = conditions[key];

      // Build the individual WHERE condition and extract its value:
      const [subWhereClauses, subWhereClauseValues] =
        this.#generateWherClauseForValue(columnName, columnValue);

      // Append the condition and value to the respective arrays:
      whereClauses = whereClauses.concat(subWhereClauses);
      whereClauseValues = whereClauseValues.concat(subWhereClauseValues);
    });

    // Return both the conditions and values arrays:
    return [whereClauses, whereClauseValues];
  }

  /**
   * Public method to add WHERE conditions to the builder.
   *
   * @param {object} conditions - The conditions to add (can be nested).
   */
  where(conditions = {}) {
    const [whereClauses, whereClauseValues] = this.#buildWhereClauses(
      conditions,
      null
    );
    this.whereClauses = this.whereConditions.concat(whereClauses);
    this.whereClauseValues = this.whereClauseValues.concat(whereClauseValues);
  }
}
