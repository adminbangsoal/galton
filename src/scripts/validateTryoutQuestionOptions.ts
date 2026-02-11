/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { tryout_questions } from '../database/schema';
import { SQL, inArray, sql } from 'drizzle-orm';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
    schema: {
      tryout_questions,
    },
});


const run = async () => {
    console.log('running')
    const optionsQuery = await db.query.tryout_questions.findMany({
        columns: {
          id: true,
          options: true,
        }
    });

    console.log('Total Options:', optionsQuery.length)

    const INVALID_OPTIONS = 'isTrue';
    const VALID_OPTIONS = "is_true";

    let stringOptionsCount = 0;
    let invalidOptionsCount = 0;
    let emptyIsTrueOptionsCount = 0;

    const invalidOptions = [];

    optionsQuery.map((optionObj) => {
      let isInvalid = false;
      let newOptionObj = optionObj;

      if (!Array.isArray(optionObj.options)) {
        stringOptionsCount++;
        try {
          newOptionObj.options = JSON.parse(optionObj.options);
        } catch (error) {
          console.error('Error parsing options:', error);
        }
      }

      let correctAnswerCount = 0;

      const updatedOptions = newOptionObj.options.map((opt) => {
        if (opt.hasOwnProperty(INVALID_OPTIONS)) {
          isInvalid = true;
          opt[VALID_OPTIONS] = opt[INVALID_OPTIONS];
          delete opt[INVALID_OPTIONS];
        }
        if (!opt.hasOwnProperty(VALID_OPTIONS)) {
          emptyIsTrueOptionsCount++;
          isInvalid = true;
          opt[VALID_OPTIONS] = false;
        }
        if (opt[VALID_OPTIONS]) {
          correctAnswerCount++;
        }
        return opt;
      });
      if (correctAnswerCount === 0) {
        isInvalid = true;
        newOptionObj.options[0][VALID_OPTIONS] = true;
      }

      if (isInvalid) {
        invalidOptionsCount++;
        invalidOptions.push(newOptionObj);
      }
    
      return {
        ...newOptionObj,
        options: updatedOptions
      };
    });

    if (invalidOptions.length > 0) {
      console.log('Invalid options:', invalidOptions.map((opt) => opt.id));
    } else {
      console.log('No invalid options found ✅');
      return 0;
    }

    console.log('Converting', invalidOptionsCount, 'invalid options...');

    const sqlChunks: SQL[] = [];
    const ids: string[] = [];
    sqlChunks.push(sql`(case`);
    for (const input of invalidOptions) {
      sqlChunks.push(sql`when tryout_questions.id = ${input.id} then (${JSON.stringify(input.options)}::JSONB)`);
      ids.push(input.id);
    }
    sqlChunks.push(sql`end)`);
    const finalSql: SQL = sql.join(sqlChunks, sql.raw(' '));
    await db.update(tryout_questions).set({ options: finalSql }).where(inArray(tryout_questions.id, ids)).execute();

    console.log('Converted', invalidOptionsCount, 'invalid options');
}

run().then(() => {
    console.log('done')
    process.exit(0)
})