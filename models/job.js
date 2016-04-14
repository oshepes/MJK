/**
 * Job Schema
 * @author Oren Shepes <oren@advertise.com>
 * @since 4/13/17
 */

imports('includes/config.js');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.connect(config.MONGODB_HOST);

var jobSchema = new Schema({
  job_id: { type: String, required: true },
  url: String,
  violations: String,
  created_at: Date,
  completed_at: Date
});

var Job = mongoose.model('Job', jobSchema);
module.exports = Job;
