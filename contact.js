/* Contact page: builds a mailto: link from the form (no server needed). */

(function contactForm() {
    const form = document.querySelector("#contact-form");
    const status = document.querySelector("#form-message");

    if (!form) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = form.querySelector("#name").value.trim();
        const email = form.querySelector("#email").value.trim();
        const subject = form.querySelector("#subject").value.trim();
        const message = form.querySelector("#message-text").value.trim();

        if (!name || !email || !subject || !message) {
            status.textContent = currentLanguage === "fr"
                ? "Merci de remplir tous les champs."
                : "Please complete all fields.";
            return;
        }

        const body = `Nom : ${name}\nEmail : ${email}\n\n${message}`;

        status.textContent = currentLanguage === "fr"
            ? "Ouverture de votre application e-mail…"
            : "Opening your email application…";

        window.location.href =
            "mailto:sabina.karimova@epitech.eu" +
            "?subject=" + encodeURIComponent(subject) +
            "&body=" + encodeURIComponent(body);
    });
})();
