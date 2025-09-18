<script lang="ts">
	import Papa from 'papaparse';
	import { onMount } from 'svelte';
	import { parse } from 'csv-parse/browser/esm/sync';
	let uploadMessage = '';
	let fileInput: HTMLInputElement;
	let csvData: any[] = [];
	let csvHeaders: string[] = [];
	let previewData: any[] = [];
	let previewHeaders: string[] = [];
	let actionSelections: string[] = [];
	let extractedAccountNumber = '';

	function syncActionSelections() {
		if (previewData.length > actionSelections.length) {
			actionSelections = [
				...actionSelections,
				...Array(previewData.length - actionSelections.length).fill('')
			];
		} else if (previewData.length < actionSelections.length) {
			actionSelections = actionSelections.slice(0, previewData.length);
		}
	}
	// Preview CSV before upload
	async function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input?.files?.[0];
		if (!file || !isCSVFile(file)) {
			previewData = [];
			previewHeaders = [];
			return;
		}
		const text = await file.text();
		// Extract account number from the second row of the original CSV
		const lines = text.split(/\r?\n/).filter(Boolean);
		extractedAccountNumber = '';
		if (lines.length >= 2) {
			const secondRow = lines[1].split(';');
			extractedAccountNumber = secondRow[0]?.replace(/[^\dA-Za-z]/g, '') || '';
		}
		// Parse CSV with semicolon delimiter
		let records: any[] = [];
		try {
			records = parse(text, { columns: true, delimiter: ';' }) as Record<string, any>[];
		} catch (e) {
			previewData = [];
			previewHeaders = [];
			return;
		}
		// Only keep relevant columns (case-insensitive match)
		const wanted = ['booking date', 'amount', 'currency', 'description'];
		const filtered = records.map((row) => {
			const out: Record<string, any> = {};
			for (const key of Object.keys(row)) {
				const lower = key.trim().toLowerCase();
				if (wanted.includes(lower)) {
					out[key] = row[key];
				}
			}
			return out;
		});
		previewData = filtered;
		previewHeaders = filtered.length > 0 ? Object.keys(filtered[0]) : [];
		syncActionSelections();
	}

	function isCSVFile(file: File) {
		return file.name.toLowerCase().endsWith('.csv');
	}

	async function handleFileUpload(event: Event) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const file = fileInput?.files?.[0];
		if (!file || !isCSVFile(file)) {
			uploadMessage = 'Please select a .csv file.';
			return;
		}

		// Read the account number from the second row of the CSV file
		// Use previewData and previewHeaders to create a new CSV file for upload
		// Extract account number from the first row if available
		// Use the extracted account number from file preview
		const accountNumber = extractedAccountNumber;

		// Add account number and action columns to data before CSV export
		const exportHeaders = [...previewHeaders, 'Account Number', 'Action'];
		const exportData = previewData.map((row, i) => ({
			...row,
			'Account Number': accountNumber,
			Action: actionSelections[i] || ''
		}));
		const csvString = Papa.unparse(exportData, { delimiter: ';', columns: exportHeaders });

		// Create a new file with the new name: accountnumber_date.csv
		const today = new Date();
		const yyyy = today.getFullYear();
		const mm = String(today.getMonth() + 1).padStart(2, '0');
		const dd = String(today.getDate()).padStart(2, '0');
		const hh = String(today.getHours()).padStart(2, '0');
		const min = String(today.getMinutes()).padStart(2, '0');
		const ss = String(today.getSeconds()).padStart(2, '0');
		const newFileName = `${accountNumber ? accountNumber + '_' : ''}${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.csv`;
		const newFile = new File([csvString], newFileName, { type: file.type });

		const formData = new FormData();
		formData.append('file', newFile);

		const response = await fetch('/api/upload', {
			method: 'POST',
			body: formData
		});
		if (response.ok) {
			uploadMessage = 'File uploaded successfully!';
			await fetchCSV();
		} else {
			const data = await response.json().catch(() => ({}));
			uploadMessage = data?.error || 'File upload failed.';
		}
	}

	async function fetchCSV() {
		const response = await fetch('/api/upload');
		if (response.ok) {
			const { data } = await response.json();
			csvData = data;
			csvHeaders = data && data.length > 0 ? Object.keys(data[0]) : [];
		} else {
			csvData = [];
			csvHeaders = [];
		}
	}

	onMount(fetchCSV);
</script>

<h1>Welcome to Fynance</h1>

<form method="POST" enctype="multipart/form-data" on:submit={handleFileUpload}>
	<input
		type="file"
		name="file"
		required
		bind:this={fileInput}
		accept=".csv"
		on:change={handleFileChange}
	/>
	<button type="submit">Upload</button>
</form>

{#if uploadMessage}
	<p>{uploadMessage}</p>
{/if}

{#if previewData.length > 0}
	<h2>Preview CSV Data</h2>
	<table border="1" style="margin-top:1em;">
		<thead>
			<tr>
				{#each previewHeaders as header}
					<th>{header}</th>
				{/each}
				<th>Action</th>
			</tr>
		</thead>
		<tbody>
			{#each previewData as row, i}
				<tr>
					{#each previewHeaders as header}
						<td style="padding-left:1em; padding-right:1em;">{row[header]}</td>
					{/each}
					<td style="padding-left:1em; padding-right:1em;">
						<select bind:value={actionSelections[i]} on:change={syncActionSelections}>
							<option value="">Select...</option>
							<option value="option1">Option 1</option>
							<option value="option2">Option 2</option>
							<option value="option3">Option 3</option>
						</select>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else if csvData.length > 0}
	<h2>Latest CSV Data</h2>
	<table border="1" style="margin-top:1em;">
		<thead>
			<tr>
				{#each csvHeaders as header}
					<th>{header}</th>
				{/each}
				<th>Action</th>
			</tr>
		</thead>
		<tbody>
			{#each csvData as row, i}
				<tr>
					{#each csvHeaders as header}
						<td style="padding-left:1em; padding-right:1em;">{row[header]}</td>
					{/each}
					<td style="padding-left:1em; padding-right:1em;">
						<select>
							<option value="">No category</option>
							<option value="option1">Salary</option>
							<option value="option2">Gasoline</option>
							<option value="option3">Insurance</option>
						</select>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
