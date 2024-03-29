/**
 * Campaign Schema
 * @author Oren Shepes <oren@advertise.com>
 * @since 4/13/17
 */

imports('includes/config.js');

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var campaignSchema = new Schema({
    account_id: { type: String, required: true },
    account_name: String,
    campaign_name: { type: String },
    adgroup_name: { type: String },
    username: { type: String },
    code: String,
    destination_url: { type: String, required: true },
    violations: String,
    created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}
});

var Campaign = mongoose.model('Campaign', campaignSchema);
module.exports = Campaign;
