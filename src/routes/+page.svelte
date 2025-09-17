<script lang="ts">
	import { onMount } from 'svelte';
	let uploadMessage = '';
	let fileInput: HTMLInputElement;
	let csvData: any[] = [];
	let csvHeaders: string[] = [];

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
		const text = await file.text();
		const lines = text.split(/\r?\n/).filter(Boolean);
		let accountNumber = '';
		if (lines.length >= 2) {
			// Try to extract the first value from the second row (assuming ; delimiter)
			const secondRow = lines[1].split(';');
			accountNumber = secondRow[0]?.replace(/[^\dA-Za-z]/g, '');
		}

		// Create a new file with the new name: accountnumber_date.csv
		const today = new Date();
		const yyyy = today.getFullYear();
		const mm = String(today.getMonth() + 1).padStart(2, '0');
		const dd = String(today.getDate()).padStart(2, '0');
		const hh = String(today.getHours()).padStart(2, '0');
		const min = String(today.getMinutes()).padStart(2, '0');
		const ss = String(today.getSeconds()).padStart(2, '0');
		const newFileName = `${accountNumber ? accountNumber + '_' : ''}${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.csv`;
		const newFile = new File([file], newFileName, { type: file.type });

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
	<input type="file" name="file" required bind:this={fileInput} accept=".csv" />
	<button type="submit">Upload</button>
</form>

{#if uploadMessage}
	<p>{uploadMessage}</p>
{/if}

{#if csvData.length > 0}
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
