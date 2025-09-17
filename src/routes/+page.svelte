<script lang="ts">
	let uploadMessage = '';
	let fileInput: HTMLInputElement;

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
		const formData = new FormData(form);
		const response = await fetch('/api/upload', {
			method: 'POST',
			body: formData
		});
		if (response.ok) {
			uploadMessage = 'File uploaded successfully!';
		} else {
			const data = await response.json().catch(() => ({}));
			uploadMessage = data?.error || 'File upload failed.';
		}
	}
</script>

<h1>Welcome to Fynance</h1>

<form method="POST" enctype="multipart/form-data" on:submit={handleFileUpload}>
	<input type="file" name="file" required bind:this={fileInput} accept=".csv" />
	<button type="submit">Upload</button>
</form>

{#if uploadMessage}
	<p>{uploadMessage}</p>
{/if}
