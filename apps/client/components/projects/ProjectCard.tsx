import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Calendar, DollarSign, User, Building2, ExternalLink, CheckCircle2, Clock, Archive } from "lucide-react";
import { ImageWithFallback } from "../../app/lib/ImageWithFallback";
import { motion } from "framer-motion";
import Link from "next/link";
import { ProjectCardData, ProjectStatus } from "../../types/project";

interface ProjectCardProps {
  project: ProjectCardData;
  index?: number;
  isInView?: boolean;
}

const getStatusConfig = (status: ProjectStatus) => {
  switch (status) {
    case 'planning':
      return {
        label: 'Planning',
        icon: Clock,
        variant: 'secondary' as const,
        className: 'bg-blue-50 text-blue-700 border-blue-200'
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        icon: Clock,
        variant: 'default' as const,
        className: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    case 'completed':
      return {
        label: 'Completed',
        icon: CheckCircle2,
        variant: 'default' as const,
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    case 'archived':
      return {
        label: 'Archived',
        icon: Archive,
        variant: 'outline' as const,
        className: 'bg-slate-50 text-slate-700 border-slate-200'
      };
  }
};

const formatCurrency = (amount?: number) => {
  if (!amount) return 'Not specified';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date?: Date) => {
  if (!date) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
};

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  index = 0, 
  isInView = true 
}) => {
  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;
  const progressPercentage = project.milestoneCount && project.completedMilestones !== undefined
    ? Math.round((project.completedMilestones / project.milestoneCount) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      whileHover={{ y: -8 }}
    >
      <Card className="overflow-hidden hover:shadow-xl transition-shadow h-full">
        <div className="aspect-video overflow-hidden bg-slate-200 relative">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <ImageWithFallback 
              src={project.imageUrl || '/professional.png'}
              alt={project.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
          <div className="absolute top-3 right-3">
            <Badge className={statusConfig.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
        
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-xl font-semibold">{project.title}</CardTitle>
              {project.description && (
                <CardDescription className="line-clamp-2 mt-1">
                  {project.description}
                </CardDescription>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mt-3">
            {project.budget && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <DollarSign className="h-4 w-4" />
                <span className="font-medium">{formatCurrency(project.budget)}</span>
              </div>
            )}
            
            {(project.startDate || project.endDate) && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="h-4 w-4" />
                <span>
                  {project.startDate && formatDate(project.startDate)}
                  {project.startDate && project.endDate && ' - '}
                  {project.endDate && formatDate(project.endDate)}
                </span>
              </div>
            )}
            
            {project.professionalName && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="h-4 w-4" />
                <span>
                  {project.professionalCompany || project.professionalName}
                </span>
              </div>
            )}
            
            {project.clientName && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="h-4 w-4" />
                <span>{project.clientName}</span>
              </div>
            )}
          </div>
          
          {progressPercentage !== null && project.milestoneCount !== undefined && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span>Progress</span>
                <span className="font-medium">{project.completedMilestones}/{project.milestoneCount} milestones</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={isInView ? { width: `${progressPercentage}%` } : { width: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.15 + 0.3 }}
                  className="bg-emerald-600 h-2 rounded-full"
                />
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href={`/projects/${project.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </Button>
            {project.status === 'in_progress' && (
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link href={`/projects/${project.id}/milestones`}>
                  Milestones
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;
