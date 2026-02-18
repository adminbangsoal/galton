/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  subjects,
  topics,
  questions as questionSchema,
  options,
  packages,
  question_attempts,
} from '../schema';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import {
  TOPICS_BINDO,
  TOPICS_BING,
  TOPICS_PBM,
  TOPICS_PKPM,
  TOPICS_PPU,
  TOPICS_PU,
} from './data/topics';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    subjects,
    topics,
    questionSchema,
    options,
    packages,
  },
});

const SUBJECT_MAPPING = {
  PBM: {
    name: 'Pemahaman Bacaan dan Menulis',
    alternate_name: 'PBM',
    icon: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/pbm.png',
    topics: TOPICS_PBM,
  },
  PKPM: {
    name: 'Pengetahuan dan Pemahaman Umum',
    alternate_name: 'PKPM',
    icon: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/pk.png',
    topics: TOPICS_PKPM,
  },
  PU: {
    name: 'Penalaran Umum',
    alternate_name: 'PU',
    icon: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/brain.png',
    topics: TOPICS_PU,
  },
  PPU: {
    name: 'Pengetahuan dan Pemahaman Umum',
    alternate_name: 'PPU',
    icon: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/brain.png',
    topics: TOPICS_PPU,
  },
  BINDO: {
    name: 'Literasi dalam Bahasa Indonesia',
    alternate_name: 'Literasi dalam Bahasa Indonesia',
    icon: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/pbm.png',
    topics: TOPICS_BINDO,
  },
  BING: {
    name: 'Literasi dalam Bahasa Inggris',
    alternate_name: 'Literasi dalam Bahasa Inggris',
    icon: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/pbm.png',
    topics: TOPICS_BING,
  },
};

// Note: PPU and PKPM have the same name but different alternate_name
// We'll use alternate_name to distinguish them

const run = async () => {
  console.log('Start seeding database from CSV files...');

  // Step 1: Seed Subjects
  console.log('\n=== Seeding Subjects ===');
  try {
    // Remove PPU since it has same name as PKPM - merge PPU topics into PKPM if needed
    const subjectsToInsert = Object.values(SUBJECT_MAPPING)
      .filter((subj) => subj.alternate_name !== 'PPU') // Skip PPU, use PKPM instead
      .map((subj) => ({
        name: subj.name,
        alternate_name: subj.alternate_name,
        icon: subj.icon,
      }));

    await db.insert(subjects).values(subjectsToInsert).onConflictDoNothing();
    console.log(`✓ Successfully seeded ${subjectsToInsert.length} subjects`);
  } catch (err: any) {
    if (err.code === '23505') {
      console.log('✓ Subjects already seeded');
    } else {
      console.error('✗ Error seeding subjects:', err.message);
    }
  }

  // Step 2: Seed Topics
  console.log('\n=== Seeding Topics ===');
  try {
    const allSubjects = await db.select().from(subjects).execute();
    const allTopics = await db.select().from(topics).execute();
    const topicsToInsert = [];

    for (const [key, subjectData] of Object.entries(SUBJECT_MAPPING)) {
      // Skip PPU - merge its topics into PKPM if they don't exist
      if (subjectData.alternate_name === 'PPU') {
        // Find PKPM subject instead
        const pkpmSubject = allSubjects.find((s) => s.alternate_name === 'PKPM');
        if (pkpmSubject) {
          // Add PPU topics to PKPM if they don't already exist
          const existingTopics = allTopics
            .filter((t) => t.subject_id === pkpmSubject.id)
            .map((t) => t.name);
          
          for (const topic of subjectData.topics) {
            if (!existingTopics.includes(topic.name)) {
              topicsToInsert.push({
                name: topic.name,
                subject_id: pkpmSubject.id,
              });
            }
          }
        }
        continue;
      }

      // Use alternate_name to find subject since some subjects have same name
      const subject = allSubjects.find((s) => s.alternate_name === subjectData.alternate_name);
      if (!subject) {
        console.warn(`⚠ Subject not found: ${subjectData.name} (${subjectData.alternate_name})`);
        continue;
      }

      // Check existing topics for this subject to avoid duplicates
      const existingTopicsForSubject = allTopics
        .filter((t) => t.subject_id === subject.id)
        .map((t) => t.name);

      for (const topic of subjectData.topics) {
        if (!existingTopicsForSubject.includes(topic.name)) {
          topicsToInsert.push({
            name: topic.name,
            subject_id: subject.id,
          });
        }
      }
    }

    if (topicsToInsert.length > 0) {
      await db.insert(topics).values(topicsToInsert).onConflictDoNothing();
      console.log(`✓ Successfully seeded ${topicsToInsert.length} topics`);
    }
  } catch (err: any) {
    if (err.code === '23505') {
      console.log('✓ Topics already seeded');
    } else {
      console.error('✗ Error seeding topics:', err.message);
    }
  }

  // Step 3: Seed Questions from CSV
  console.log('\n=== Seeding Questions from CSV ===');
  try {
    const questionsCsvPath = path.join(__dirname, 'data', 'questions.csv');
    if (!fs.existsSync(questionsCsvPath)) {
      throw new Error(`Questions CSV file not found: ${questionsCsvPath}`);
    }

    const csvContent = fs.readFileSync(questionsCsvPath, 'utf-8');
    const questionsData = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });

    console.log(`Found ${questionsData.length} questions in CSV`);

    // Get all topics for mapping
    const allTopics = await db.select().from(topics).execute();
    const allSubjects = await db.select().from(subjects).execute();

    // Delete existing data
    await db.delete(question_attempts).execute();
    await db.delete(options).execute();
    await db.delete(questionSchema).execute();

    const questionsToInsert = [];
    let skippedCount = 0;

    for (const row of questionsData) {
      const topic = allTopics.find((t) => t.id === row.topic_id);
      if (!topic) {
        skippedCount++;
        continue;
      }

      const subject = allSubjects.find((s) => s.id === topic.subject_id);
      if (!subject) {
        skippedCount++;
        continue;
      }

      // Extract year from code or use default
      const yearMatch = row.code?.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : 2023;

      // Extract source from code (e.g., "A/PU/32" -> "A")
      const source = row.code?.split('/')[0] || 'UNKNOWN';

      questionsToInsert.push({
        id: row.id,
        content: {
          content: row.content || '',
          asset_url: row.assets_url || row.img_url || '',
        },
        answer: {
          content: row.answer || row.raw_answer || '',
          asset_url: row.answer_asset || '',
        },
        topic_id: row.topic_id,
        subject_id: subject.id,
        year: year,
        source: source,
        type: row.type === 'SINGLEANSWER' ? 'multiple-choice' : 'multiple-choice',
      });
    }

    if (questionsToInsert.length > 0) {
      // Insert in batches to avoid memory issues
      const batchSize = 1000;
      for (let i = 0; i < questionsToInsert.length; i += batchSize) {
        const batch = questionsToInsert.slice(i, i + batchSize);
        await db.insert(questionSchema).values(batch).onConflictDoNothing();
        console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(questionsToInsert.length / batchSize)}`);
      }
      console.log(`✓ Successfully seeded ${questionsToInsert.length} questions`);
      if (skippedCount > 0) {
        console.log(`⚠ Skipped ${skippedCount} questions (topic not found)`);
      }
    }
  } catch (err: any) {
    console.error('✗ Error seeding questions:', err.message);
    console.error(err.stack);
  }

  // Step 4: Seed Choices/Options from CSV
  console.log('\n=== Seeding Choices/Options from CSV ===');
  try {
    const choicesCsvPath = path.join(__dirname, 'data', 'choices.csv');
    if (!fs.existsSync(choicesCsvPath)) {
      throw new Error(`Choices CSV file not found: ${choicesCsvPath}`);
    }

    const csvContent = fs.readFileSync(choicesCsvPath, 'utf-8');
    const choicesData = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });

    console.log(`Found ${choicesData.length} choices in CSV`);

    // Group choices by question_id
    const choicesByQuestion: Record<string, any[]> = {};
    for (const choice of choicesData) {
      if (!choicesByQuestion[choice.question_id]) {
        choicesByQuestion[choice.question_id] = [];
      }
      choicesByQuestion[choice.question_id].push({
        id: crypto.randomUUID(),
        content: choice.content || '',
        is_true: choice.is_correct === 't' || choice.is_correct === true,
        key: choice.key || '',
      });
    }

    // Get all existing questions
    const allQuestions = await db.select().from(questionSchema).execute();
    const questionIds = new Set(allQuestions.map((q) => q.id));

    // Delete existing options
    await db.delete(options).execute();

    let insertedCount = 0;
    let skippedCount = 0;

    // Insert options in batches
    const optionsToInsert = [];
    for (const [questionId, choiceList] of Object.entries(choicesByQuestion)) {
      if (!questionIds.has(questionId)) {
        skippedCount++;
        continue;
      }

      // Limit to 5 choices per question
      const limitedChoices = choiceList.slice(0, 5);

      optionsToInsert.push({
        question_id: questionId,
        options: limitedChoices,
      });
    }

    if (optionsToInsert.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < optionsToInsert.length; i += batchSize) {
        const batch = optionsToInsert.slice(i, i + batchSize);
        await db.insert(options).values(batch).onConflictDoNothing();
        insertedCount += batch.length;
        console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(optionsToInsert.length / batchSize)}`);
      }
      console.log(`✓ Successfully seeded ${insertedCount} question options`);
      if (skippedCount > 0) {
        console.log(`⚠ Skipped ${skippedCount} question options (question not found)`);
      }
    }
  } catch (err: any) {
    console.error('✗ Error seeding choices:', err.message);
    console.error(err.stack);
  }

  // Step 5: Seed Packages
  console.log('\n=== Seeding Packages ===');
  try {
    await db
      .insert(packages)
      .values([
        {
          name: 'Paket Hemat',
          description: 'Paket Hemat',
          price: 20000,
          price_label: '20.000',
          validity: 30,
        },
        {
          name: 'Paket Jagoan',
          description: 'Paket Jagoan',
          price: 55000,
          price_label: '55.000',
          validity: 60,
        },
        {
          name: 'Paket Juara',
          description: 'Paket Juara',
          price: 100000,
          price_label: '100.000',
          validity: 90,
        },
      ])
      .onConflictDoNothing();
    console.log('✓ Successfully seeded packages');
  } catch (err: any) {
    if (err.code === '23505') {
      console.log('✓ Packages already seeded');
    } else {
      console.error('✗ Error seeding packages:', err.message);
    }
  }

  console.log('\n✅ Seeding completed!');
};

run()
  .then(() => {
    console.log('Seeding done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    console.log('Seeding failed');
    process.exit(1);
  });
