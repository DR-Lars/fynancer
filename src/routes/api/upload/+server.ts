import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file');

	if (!file || typeof file === 'string') {
		return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400 });
	}

	// Only allow .csv files
	const fileName = file.name || '';
	if (!fileName.toLowerCase().endsWith('.csv')) {
		return new Response(JSON.stringify({ error: 'Only .csv files are allowed' }), { status: 400 });
	}

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
