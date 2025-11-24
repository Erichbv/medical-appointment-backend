import Joi from "joi";
import type { CreateAppointmentRequestDTO } from "../dto/CreateAppointmentRequestDTO.js";

const createAppointmentSchema = Joi.object<CreateAppointmentRequestDTO>({
  insuredId: Joi.string().required().messages({
    "string.base": "El campo insuredId debe ser una cadena de texto",
    "any.required": "El campo insuredId es requerido",
  }),
  scheduleId: Joi.number().integer().positive().required().messages({
    "number.base": "El campo scheduleId debe ser un número",
    "number.integer": "El campo scheduleId debe ser un número entero",
    "number.positive": "El campo scheduleId debe ser un número positivo",
    "any.required": "El campo scheduleId es requerido",
  }),
  countryISO: Joi.string().valid("PE", "CL").required().messages({
    "string.base": "El campo countryISO debe ser una cadena de texto",
    "any.only": "El campo countryISO debe ser 'PE' o 'CL'",
    "any.required": "El campo countryISO es requerido",
  }),
});

export { createAppointmentSchema };

