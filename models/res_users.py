# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ResUsers(models.Model):
    _inherit = 'res.users'

    rfid_card_id = fields.Char(
        string='ID de Tarjeta RFID',
        size=64,
        help='Identificación de tarjeta RFID para autenticación en POS'
    )
    
    pos_require_rfid = fields.Boolean(
        string='Requerir RFID para POS',
        default=False,
        help='Si está habilitado, este usuario debe autenticarse con tarjeta RFID en POS'
    )
    
    pos_rfid_pin_combination = fields.Boolean(
        string='Combinación RFID + PIN',
        default=True,
        help='Requerir tanto tarjeta RFID como PIN para autenticación'
    )

    @api.constrains('rfid_card_id')
    def _check_rfid_card_unique(self):
        for user in self:
            if user.rfid_card_id:
                # Check if RFID card is already assigned to another user
                existing_user = self.search([
                    ('rfid_card_id', '=', user.rfid_card_id),
                    ('id', '!=', user.id)
                ])
                if existing_user:
                    raise UserError(_('El ID de Tarjeta RFID "%s" ya está asignado al usuario "%s"') % (
                        user.rfid_card_id, existing_user.name))

    @api.model
    def authenticate_rfid(self, rfid_card_id, pin=None):
        """
        Authenticate user with RFID card and optional PIN
        Returns the user if authentication is successful, False otherwise
        """
        import logging
        _logger = logging.getLogger(__name__)
        
        _logger.info('RFID Authentication attempt: card_id=%s, pin=%s', rfid_card_id, 'provided' if pin else 'not_provided')
        
        # Search for user with this RFID card
        user = self.search([('rfid_card_id', '=', rfid_card_id)], limit=1)
        _logger.info('RFID Card search result: %s', user.name if user else 'No user found')
        
        if not user:
            _logger.warning('No user found with RFID card: %s', rfid_card_id)
            return False
            
        _logger.info('User found: %s (ID: %s)', user.name, user.id)
        _logger.info('User RFID settings: pos_rfid_pin_combination=%s, has_pos_security_pin=%s', 
                    user.pos_rfid_pin_combination, bool(user.pos_security_pin))
            
        # If user requires PIN combination, check it
        if user.pos_rfid_pin_combination and user.pos_security_pin:
            if not pin or pin != user.pos_security_pin:
                _logger.warning('PIN required but not provided or incorrect for user: %s', user.name)
                return False
        
        _logger.info('RFID Authentication successful for user: %s', user.name)
        return {
            'id': user.id,
            'name': user.name,
            'login': user.login,
            'pos_security_pin': user.pos_security_pin,
            'rfid_card_id': user.rfid_card_id
        }

    @api.model
    def get_rfid_users_for_pos(self):
        """
        Get all users with RFID cards for POS authentication
        """
        return self.search([
            ('rfid_card_id', '!=', False),
            ('pos_require_rfid', '=', True)
        ]).read(['id', 'name', 'rfid_card_id', 'pos_rfid_pin_combination']) 