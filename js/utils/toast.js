export function showToast(
  message,
  type = "success"
) {

  Toastify({

    text: message,

    duration: 3000,

    gravity: "top",

    position: "right",

    close: true,

    style: {
      background:
        type === "error"
          ? "#ef4444"
          : "#22c55e"
    }

  }).showToast();

}