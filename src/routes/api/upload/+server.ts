import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	S3Client,
	PutObjectCommand,
	ListObjectsV2Command,
	GetObjectCommand,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';

export const GET: RequestHandler = async () => {
	// S3 config from environment variables
	const s3 = new S3Client({
		region: process.env.S3_REGION || 'eu-central-1',
		endpoint: process.env.S3_ENDPOINT,
		credentials: {
			accessKeyId: process.env.S3_ACCESS_KEY || '',
			secretAccessKey: process.env.S3_SECRET_KEY || ''
		},
		forcePathStyle: true
	});

	try {
		// List all CSV files in the bucket
		const listRes = await s3.send(
			new ListObjectsV2Command({
				Bucket: process.env.S3_BUCKET,
				Prefix: ''
			})
		);
		const csvFiles = (listRes.Contents || [])
			.filter((obj) => obj.Key && obj.Key.endsWith('.csv'))
			.sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));
		if (!csvFiles.length) {
			return new Response(JSON.stringify({ error: 'No CSV files found' }), { status: 404 });
		}
		const latestKey = csvFiles[0].Key;
		// Get the latest CSV file
		const getObj = await s3.send(
			new GetObjectCommand({
				Bucket: process.env.S3_BUCKET,
				Key: latestKey
			})
		);
		const stream = getObj.Body;
		let csvString = '';
		if (stream && typeof stream === 'object') {
			if (typeof (stream as any)[Symbol.asyncIterator] === 'function') {
				const chunks = [];
				for await (const chunk of stream as any) {
					chunks.push(chunk);
				}
				csvString = Buffer.concat(chunks).toString('utf-8');
			} else if (typeof (stream as any).arrayBuffer === 'function') {
				// Browser/edge: stream is a Blob or has arrayBuffer
				const buf = Buffer.from(await (stream as any).arrayBuffer());
				csvString = buf.toString('utf-8');
			} else {
				return new Response(JSON.stringify({ error: 'Unknown stream type' }), { status: 500 });
			}
		} else {
			return new Response(JSON.stringify({ error: 'No stream returned from S3' }), { status: 500 });
		}
		// Parse CSV with semicolon delimiter
		const records = parse(csvString, { columns: true, delimiter: ';' }) as Record<string, any>[];
		// Map alternate column names to 'Date', 'Amount', 'Currency', 'Description'
		const columnMap: Record<string, string> = {
			datum: 'Date',
			uitvoeringsdatum: 'Date',
			'booking date': 'Date',
			date: 'Date',
			bedrag: 'Amount',
			amount: 'Amount',
			'valuta rekening': 'Currency',
			valuta: 'Currency',
			currency: 'Currency',
			mededeling: 'Description',
			description: 'Description',
			category: 'Category'
		};
		const wanted = ['Date', 'Amount', 'Currency', 'Description'];
		const filtered = records.map((row) => {
			const out: Record<string, any> = {};
			for (const key of Object.keys(row)) {
				const lower = key.trim().toLowerCase();
				const mapped = columnMap[lower];
				if (mapped && wanted.includes(mapped)) {
					out[mapped] = row[key];
				}
			}
			return out;
		});
		return json({ data: filtered });
	} catch (err) {
		console.error('S3 fetch error:', err);
		return new Response(JSON.stringify({ error: 'Failed to fetch CSV from S3' }), { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file');

	let accountNumberPrefix = '';
	if (file && typeof file !== 'string' && file.name) {
		const newFileName = file.name;
		const accountNumberMatch = newFileName.match(/^([A-Za-z0-9]+)_/);
		accountNumberPrefix = accountNumberMatch ? accountNumberMatch[1] : '';
	}

	// Delete only CSV files with the same account number prefix as the new file
	if (accountNumberPrefix) {
		try {
			const s3List = new S3Client({
				region: process.env.S3_REGION || 'eu-central-1',
				endpoint: process.env.S3_ENDPOINT,
				credentials: {
					accessKeyId: process.env.S3_ACCESS_KEY || '',
					secretAccessKey: process.env.S3_SECRET_KEY || ''
				},
				forcePathStyle: true
			});
			const listRes = await s3List.send(
				new ListObjectsV2Command({
					Bucket: process.env.S3_BUCKET,
					Prefix: ''
				})
			);
			const csvFiles = (listRes.Contents || []).filter(
				(obj) => obj.Key && obj.Key.endsWith('.csv')
			);
			for (const fileObj of csvFiles) {
				if (fileObj.Key && fileObj.Key.startsWith(accountNumberPrefix + '_')) {
					await s3List.send(
						new DeleteObjectCommand({
							Bucket: process.env.S3_BUCKET,
							Key: fileObj.Key
						})
					);
				}
			}
		} catch (err) {
			console.error('S3 delete error:', err);
			// Continue even if delete fails
		}
	}

	if (!file || typeof file === 'string') {
		return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400 });
	}

	// Only allow .csv files
	const originalName = file.name || '';
	if (!originalName.toLowerCase().endsWith('.csv')) {
		return new Response(JSON.stringify({ error: 'Only .csv files are allowed' }), { status: 400 });
	}

	// Use the filename provided by the client (with account number and date)
	const fileName = file.name;

	// Read file as Buffer
	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	// S3 config from environment variables
	const s3 = new S3Client({
		region: process.env.S3_REGION || 'eu-central-1',
		endpoint: process.env.S3_ENDPOINT,
		credentials: {
			accessKeyId: process.env.S3_ACCESS_KEY || '',
			secretAccessKey: process.env.S3_SECRET_KEY || ''
		},
		forcePathStyle: true
	});

	try {
		await s3.send(
			new PutObjectCommand({
				Bucket: process.env.S3_BUCKET,
				Key: fileName,
				Body: buffer,
				ContentType: file.type || 'text/csv'
			})
		);
		return json({ success: true });
	} catch (err) {
		console.error('S3 upload error:', err);
		return new Response(JSON.stringify({ error: 'Failed to upload to S3' }), { status: 500 });
	}
};
