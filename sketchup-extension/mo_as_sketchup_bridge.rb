# frozen_string_literal: true
# محمد أسعد للتنجيد والتصميم الهندسي — SketchUp Bridge
# Imports a project handoff JSON and creates separately named panel components.
# IMPORTANT: This creates a parts-layout model, NOT an assembled furniture model.
require 'sketchup.rb'
require 'json'

module MohammedAsaad
  module SketchUpBridge
    extend self

    MENU_NAME = 'محمد أسعد | استيراد مشروع الشركة'.freeze
    DICT = 'MohammedAsaad'.freeze

    def mm(value)
      value.to_f.mm
    end

    def safe_name(value)
      value.to_s.strip.gsub(/[\\\\\/\:\*\?\"<>\|]/, '-')[0, 80]
    end

    def import_project
      model = nil
      operation_started = false
      path = UI.openpanel('اختر ملف مشروع الشركة JSON', '', 'JSON Files|*.json||')
      return unless path

      data = JSON.parse(File.read(path, encoding: 'UTF-8'))
      project = data.fetch('project')
      catalog = project['manufacturing_catalog'] || project.dig('design_data', 'manufacturing_catalog')
      raise 'لا يحتوي الملف على كتالوج تصنيع. افتح الكتالوج واحفظه ثم أعد التصدير.' unless catalog.is_a?(Hash)

      parts = catalog['parts']
      raise 'قائمة القطع فارغة.' unless parts.is_a?(Array) && !parts.empty?

      board = catalog['board'] || {}
      thickness = board['thickness'].to_f
      raise 'سماكة اللوح غير محددة.' unless thickness.positive?

      model = Sketchup.active_model
      model.start_operation('استيراد مشروع محمد أسعد', true)
      operation_started = true
      root = model.entities.add_group
      root.name = safe_name("مشروع #{project['project_no']} - #{project['title']}")
      root.set_attribute(DICT, 'source', 'MohammedAsaad project JSON')
      root.set_attribute(DICT, 'project_no', project['project_no'].to_s)
      root.set_attribute(DICT, 'catalog_version', catalog['version'].to_i)

      parts_group = root.entities.add_group
      parts_group.name = 'قائمة القطع - عرض منفصل غير مركب'
      spacing = 80.mm
      cursor_x = 0.mm
      cursor_y = 0.mm
      row_depth = 0.mm
      max_row_width = 2400.mm
      created = 0

      parts.each do |part|
        width = part['width'].to_f
        height = part['height'].to_f
        qty = part['qty'].to_i
        next unless width.positive? && height.positive? && qty.positive?

        qty.times do |index|
          w = mm(width)
          h = mm(height)
          t = mm(thickness)
          if cursor_x + w > max_row_width
            cursor_x = 0.mm
            cursor_y += row_depth + spacing
            row_depth = 0.mm
          end

          component = parts_group.entities.add_group
          component.name = safe_name("#{part['name']} #{index + 1}")
          component.set_attribute(DICT, 'part_name', part['name'].to_s)
          component.set_attribute(DICT, 'width_mm', width)
          component.set_attribute(DICT, 'height_mm', height)
          component.set_attribute(DICT, 'thickness_mm', thickness)
          component.set_attribute(DICT, 'quantity_index', index + 1)

          pts = [
            Geom::Point3d.new(cursor_x, cursor_y, 0),
            Geom::Point3d.new(cursor_x + w, cursor_y, 0),
            Geom::Point3d.new(cursor_x + w, cursor_y + h, 0),
            Geom::Point3d.new(cursor_x, cursor_y + h, 0)
          ]
          face = component.entities.add_face(pts)
          raise "تعذر إنشاء القطعة: #{part['name']}" unless face
          face.reverse! if face.normal.z < 0
          face.pushpull(t)

          cursor_x += w + spacing
          row_depth = [row_depth, h].max
          created += 1
        end
      end

      raise 'لم يتم إنشاء أي قطع صالحة.' if created.zero?
      model.commit_operation
      operation_started = false
      model.active_view.zoom_extents
      UI.messagebox("تم استيراد #{created} مكوّناً.
هذه معاينة ألواح منفصلة حسب قائمة القص، وليست تجميعاً نهائياً للأثاث.")
    rescue StandardError => e
      model.abort_operation if model && operation_started
      UI.messagebox("تعذر الاستيراد:\n#{e.message}")
    end

    unless file_loaded?(__FILE__)
      UI.menu('Extensions').add_item(MENU_NAME) { import_project }
      file_loaded(__FILE__)
    end
  end
end
