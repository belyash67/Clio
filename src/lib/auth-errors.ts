export function authErrorMessage(error: { status?: number; code?: string }) {
  if (error.code === "PRIVACY_CONSENT_REQUIRED") return "Прочитай политику и подтверди обработку и зарубежную передачу данных. Если страница давно открыта, обнови её.";
  if (error.status === 429) return "Слишком много попыток. Подожди минуту и попробуй снова.";
  if (error.status === 503) return "Вход и регистрация временно недоступны. Попробуй позже.";
  if (error.status && error.status >= 500) return "На сервере возникла ошибка. Попробуй позже — менять пароль не нужно.";
  if (error.code === "FAILED_TO_CREATE_USER" || error.code === "FAILED_TO_CREATE_SESSION") return "Не удалось сохранить аккаунт или сессию на сервере. Попробуй позже.";
  if (error.code === "EMAIL_NOT_VERIFIED") return "Сначала подтверди email по ссылке из письма. При необходимости запроси письмо повторно.";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "Не удалось войти. Проверь email и пароль.";
  return "Не удалось выполнить действие. Проверь данные формы. Если используешь ссылку из письма, запроси новую.";
}
