import { showToast } from "./toast.js";

export async function extractTasksFromText(text) {

  try {

    const res = await fetch('/api/extract', {

      method: 'POST',

      headers: {
        'Content-Type':'application/json'
      },

      body: JSON.stringify({ text })

    });


    if (!res.ok) {

      console.error(
        'Extraction failed',
        await res.text()
      );

      showToast(
        "Could not extract tasks",
        "error"
      );

      return [];

    }


    const data =
    await res.json();


    showToast(
      "Tasks extracted successfully"
    );


    return data;

  }

  catch(e){

    console.error(
      'Error hitting extract endpoint',
      e
    );

    showToast(
      "Something went wrong",
      "error"
    );

    return [];

  }

}