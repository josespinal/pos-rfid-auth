# -*- coding: utf-8 -*-

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_rfid_auth = fields.Boolean(
        string='Habilitar Autenticación RFID',
        default=False,
        help='Habilitar autenticación con tarjeta RFID para este POS'
    )
    
    rfid_auto_lock = fields.Boolean(
        string='Bloqueo Automático de Pantalla',
        default=True,
        help='Bloquear automáticamente la pantalla del POS después de inactividad'
    )
    
    rfid_lock_timeout = fields.Integer(
        string='Tiempo de Bloqueo (minutos)',
        default=5,
        help='Tiempo en minutos antes de que la pantalla se bloquee automáticamente'
    )
    
    rfid_require_pin = fields.Boolean(
        string='Siempre Requerir PIN',
        default=False,
        help='Siempre requerir PIN incluso para usuarios de solo RFID'
    )
    
    rfid_only_mode = fields.Boolean(
        string='Modo Solo RFID',
        default=False,
        help='Ocultar entrada de PIN y solo permitir autenticación por RFID'
    )