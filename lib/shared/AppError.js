// =============================================================
// خطأ تطبيقي موحّد — يحمل رمز ترجمة (code) + رمز حالة HTTP
// تُلقيه الخدمات، وتُحوّله طبقة respond() إلى استجابة JSON متّسقة.
// =============================================================
class AppError extends Error {
  constructor(message, { code = 'serverErrors.common.serverError', statusCode = 400 } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }

  static badRequest(message, code = 'serverErrors.common.validation') {
    return new AppError(message, { code, statusCode: 400 });
  }
  static unauthorized(message, code = 'serverErrors.common.unauthenticated') {
    return new AppError(message, { code, statusCode: 401 });
  }
  static forbidden(message, code = 'serverErrors.common.forbidden') {
    return new AppError(message, { code, statusCode: 403 });
  }
  static notFound(message, code = 'serverErrors.common.notFound') {
    return new AppError(message, { code, statusCode: 404 });
  }
  static conflict(message, code = 'serverErrors.common.conflict') {
    return new AppError(message, { code, statusCode: 409 });
  }
}

module.exports = { AppError };
