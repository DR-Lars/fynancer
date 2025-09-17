import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file');

	if (!file || typeof file === 'string') {
		return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400 });
	}

	// Only allow .csv files
	const originalName = file.name || '';
	if (!originalName.toLowerCase().endsWith('.csv')) {
		return new Response(JSON.stringify({ error: 'Only .csv files are allowed' }), { status: 400 });
	}

	// Use today's date and time as the file name (YYYY-MM-DD_HH-MM-SS.csv)
	const today = new Date();
	const yyyy = today.getFullYear();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	const hh = String(today.getHours()).padStart(2, '0');
	const min = String(today.getMinutes()).padStart(2, '0');
	const ss = String(today.getSeconds()).padStart(2, '0');
	const fileName = `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.csv`;

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
