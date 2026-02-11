import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import axios from "axios";
import { extractedContent, Question, questions, subjects, topics } from '../database/schema';
import { and, eq, sql } from 'drizzle-orm';
import { extractChoices, getGDriveImageUrl, scanImageUrlService } from '../mathpix/functions';
import { v4 } from "uuid"

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
    schema: {
        extractedContent,
        questions,
        subjects,
        topics
    },
});

const QUESTION_TYPE_MAPPING = {
    "ISIAN": 'fill-in',
    "TABEL": "table-choice",
    "PILIHAN": "multiple-choice",
}


const run = async () => {
    console.log("Running Upload Soal from Spreadsheet");

    const SPREADSHEETURL = process.env.SPREADSHEET_URL;

    const spreadSheetId = SPREADSHEETURL.split('/d/')?.[1]?.split('/')[0];
    const apiKey = process.env.GOOGLE_API_KEY;
    const range = "ready-to-upload!A1:Z1000"
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadSheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;

    const response = await axios.get(url);

    console.log("Success Fetching Google Drive Data...");

    const rows = response.data.values;

    for (let i = 0; i < rows.length; i++) {
        console.log('Processing row', i);
        const insertQuestion = {
            source: "", // done
            year: 2024, // done
            question: [], // done
            type: 'multiple-choice', // done
            topic_id: '', // done
            subject_id: '', // done
            options: [], // done
            published: false, // done
            answers: [],
            filledAnswer: [],
        } as Question;

        const label = rows[i][2]
        const subject = rows[i][3]

        const soals = rows[i][4]
        const pilihanJawaban = rows[i][5]
        const pembahasan = rows[i][6]
        const gambarSoal = rows[i][7]
        const gambarPembahasan = rows[i][8]
        const tipeSoal = rows[i][10]


        insertQuestion.source = label
        insertQuestion.type = QUESTION_TYPE_MAPPING[tipeSoal] || 'multiple-choice'

        let soalList = soals?.split(',')
        let gambarSoalList = gambarSoal?.split(',')
        let pembahasanList = pembahasan?.split(',')

        // remove gambarSoalList if its only an empty string
        gambarSoalList = gambarSoalList.filter((url) => url.trim() !== "")
        soalList = soalList.filter((url) => url.trim() !== "")
        pembahasanList = pembahasanList.filter((url) => url.trim() !== "")

        const soal = Array.from({ length: (soalList.length + gambarSoalList.length) }, (_, i) => {
            return {
                content: "",
                isMedia: false,
            }
        })
        let soalListCounter = 0;
        let gambarSoalListCounter = 0
        console.log("Extracting Soal and Gambar Soal...")
        //  extract soal and gambar soal
        for (let k = 0; k < soal.length; k++) {
            if (k % 2 == 0) { // if its even then its not a media
                let latex = '';

                const extractedContentQuery = await db.query.extractedContent.findFirst({
                    where: eq(extractedContent.sourceUrl, soalList[soalListCounter])
                })

                if (extractedContentQuery) {
                    console.log("Extracted Content Found")
                    latex = extractedContentQuery.extractedContent
                } else {
                    console.log("Extracted Content Not Found. Scanning Image...")
                    latex = await scanImageUrlService(soalList[soalListCounter])
                    await db.insert(extractedContent).values({
                        sourceUrl: soalList[soalListCounter],
                        url: soalList[soalListCounter],
                        extractedContent: latex,
                    })
                    console.log("Extracted Content Inserted to the database")
                }

                soal[k].content = latex
                soal[k].isMedia = false
                soalListCounter++
            }
            else {
                console.log("Inserting Media URL")
                soal[k].content = getGDriveImageUrl(gambarSoalList[gambarSoalListCounter])
                soal[k].isMedia = true
                gambarSoalListCounter++
            }
        }

        insertQuestion.question = soal

        const questionQuery = await db.query.questions.findMany({
            where: and(eq(questions.source, insertQuestion.source), eq(questions.year, insertQuestion.year))
        })

        // check if the question already exists
        for (let q = 0; q < questionQuery.length; q++) {
            if (questionQuery[q].question.length === insertQuestion.question.length) {
                let isSame = true
                for (let j = 0; j < insertQuestion.question.length; j++) {
                    if (questionQuery[q].question[j].content !== insertQuestion.question[j].content) {
                        isSame = false
                        break
                    }
                }
                if (isSame) {
                    console.log("Question already exists. Skipping...")
                    continue
                }
            }
        }

        console.log("Extracting Pilihan Jawaban...")
        if (pilihanJawaban) {
            const extractContent = await db.query.extractedContent.findFirst({
                where: eq(extractedContent.sourceUrl, pilihanJawaban)
            })

            let choices = ''
            if (extractContent) {
                choices = extractContent.extractedContent
            } else {
                choices = await scanImageUrlService(pilihanJawaban)
                await db.insert(extractedContent).values({
                    sourceUrl: pilihanJawaban,
                    url: pilihanJawaban,
                    extractedContent: choices,
                })
            }
            const extractedChoices = extractChoices(choices)
            insertQuestion.options = Object.keys(extractedChoices).map((key) => {
                return {
                    id: v4(),
                    content: extractedChoices[key],
                    key: key,
                    is_true: false,
                }
            })
        }


        console.log("Labeling the subject and topic...")

        const subjectQuery = await db.query.subjects.findFirst({
            where: eq(subjects.name, subject)
        })

        if (!subjectQuery) {
            throw new Error(`Subject ${subject} not found.`)
        }
        insertQuestion.subject_id = subjectQuery.id

        const combinedSoal = soal.filter((soal) => soal.isMedia === false).map((soal) => soal.content).join("\n")
        const topic = await axios.post<{
            data: string
        }>("https://ai.bangsoal.co/predict-type-task", {
            question: combinedSoal,
            main_type: subject.toLowerCase()
        }, {
            headers: {
                'access-key': process.env.BANGSOAL_AI_API_KEY
            }
        })
        const topicQuery = await db.query.topics.findFirst({
            where: and(eq(topics.subject_id, subjectQuery.id), eq(topics.name, topic.data.data))
        })

        if (!topicQuery) {
            throw new Error(`Topic ${topic.data.data} not found.`)
        }
        insertQuestion.topic_id = topicQuery.id

        // insert pembahasan
        for (let p = 0; p < pembahasanList.length; p++) {
            const extractedContentQuery = await db.query.extractedContent.findFirst({
                where: eq(extractedContent.sourceUrl, pembahasanList[p])
            })

            let pembahasan = ''

            if (extractedContentQuery) {
                pembahasan = extractedContentQuery.extractedContent
            } else {
                const latex = await scanImageUrlService(pembahasanList[p])
                await db.insert(extractedContent).values({
                    sourceUrl: pembahasanList[p],
                    url: pembahasanList[p],
                    extractedContent: latex,
                })

                pembahasan = latex

            }

            // TODO: PARAPHRASE PEMBAHASAN
            insertQuestion.answers.push({
                content: pembahasan,
                isMedia: false,
            })
        }



        console.log('Inserting Question to database', insertQuestion);
        await db.insert(questions).values(insertQuestion).execute();
    }

    console.log("Done Upload Soal Script!")
}

run().then(() => {
    console.log("done");
    process.exit(0);
}).catch((e) => {
    console.error(e);
    process.exit(1);
})